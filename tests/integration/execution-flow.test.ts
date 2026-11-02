/**
 * **執行流程**（spec 205 重構 6c-3：改由 Cella 的工作階段背書）——學生按執行／單步走的那一條路。
 *
 * 原本對 JS 直譯器的 `execute`／`executeWithSteps`／`maxSteps` 斷言；同樣的五件事改問 Cella：
 *
 * ```
 * 印一句 · 宣告後印出 · 單步紀錄（stepIn 一顆一顆往前）· 步數上限 · 讀輸入（awaiting-input → supplyInput）
 * ```
 *
 * 🔴 **步數上限在工作階段那條路今天不成立**：`createCellaProvider` 的工作階段沒有讀 `SessionOptions.maxSteps`
 * （`cella-lang/dap` 的 `fuel` 是「每一段」的步數，段與段之間交回事件迴圈、不是總預算）——無窮迴圈會一直跑到使用者按停止。
 * 判決那條路有（`fuel` 的 unknown）。見「步數上限」那兩條。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { cellaProvider, openCella, waitSession } from '../helpers/cella-session'
import { runCella } from '../helpers/cella-run'
import type { Outcome, Provider } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'

const H = '#include <iostream>\nusing namespace std;\n'
let parser: Parser
let p: Provider
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  p = await cellaProvider()
  await waitSession(p, lift(H + 'int main() { return 0; }'))
}, 400_000)

const find = (t: SemanticNode, id: string | null): SemanticNode | undefined => {
  if (t.id === id) return t
  for (const k of Object.values(t.slots ?? {})) for (const c of k) { const r = find(c, id); if (r) return r }
  return undefined
}

const INFINITE = H + 'int main() {\n  int x = 1;\n  while (x > 0) {\n    x = 1;\n  }\n  return 0;\n}\n'

describe('執行流程（Cella 工作階段）', () => {
  it('印一句：一路跑完，輸出正確', async () => {
    const tree = lift(H + 'int main() {\n  cout << "Hello, World!";\n  return 0;\n}\n')
    const { s, out } = openCella(p, tree)
    expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
    expect(out()).toBe('Hello, World!')
  })

  it('宣告變數後印出', async () => {
    const tree = lift(H + 'int main() {\n  int x = 42;\n  cout << x;\n  return 0;\n}\n')
    const { s, out } = openCella(p, tree)
    expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
    expect(out()).toBe('42')
  })

  it('單步紀錄：stopOnEntry 之後每次 stepIn 往前一顆，經過宣告與指定、最後跑完', async () => {
    const tree = lift(H + 'int main() {\n  int x = 10;\n  x = 20;\n  return 0;\n}\n')
    const { s } = openCella(p, tree)
    let o: Outcome = await s.launch(tree, { stopOnEntry: true })
    const steps: string[] = []
    let guard = 0
    while (o.kind === 'stopped' && guard++ < 100) {
      steps.push(find(tree, o.stop.nodeId)?.componentId ?? `?${o.stop.nodeId}`)
      o = await s.stepIn()
    }
    expect(o).toEqual({ kind: 'ended' })
    expect(steps.filter((x) => x.startsWith('?')), '停點要對得回語義樹的節點').toEqual([])
    expect(steps).toEqual(expect.arrayContaining(['cpp:var_declare', 'cpp:var_assign']))
    expect(steps.indexOf('cpp:var_declare')).toBeLessThan(steps.indexOf('cpp:var_assign'))
  })

  it('步數上限（判決那條路）：無窮迴圈 → unknown，原因是 fuel，不是 accept 也不是 reject', async () => {
    const r = await runCella(INFINITE, { steps: 2000 })
    expect(r.verdict).toBe('unknown')
    expect(r.problems.map((x) => x.kind)).toEqual(['fuel'])
  })

  /**
   * 🟢 spec 205 T010 修好（原本是釘子）：工作階段原本不看 `maxSteps`——產品的控制器傳 1000 萬步，JS 直譯器照它停、
   * Cella 的工作階段一直跑，學生寫出無窮迴圈要自己按停止。現在 worker 在段與段之間加總步數（各節點走過的次數），
   * 超過上限就暫停並停成「步數用完」（`RUNTIME_ERR_MAX_STEPS`，中文說「可能是無窮迴圈或過深的遞迴」）。
   */
  it('🔴 工作階段的步數上限：無窮迴圈在上限處停下，停止原因是「步數用完」', async () => {
    const tree = lift(INFINITE)
    const { s } = openCella(p, tree, { maxSteps: 50_000 })
    let settled: Outcome | 'pending' = 'pending'
    void s.launch(tree, { stopOnEntry: false }).then((o) => { settled = o })
    const t = Date.now()
    while (settled === 'pending' && Date.now() - t < 10_000) await new Promise((r) => setTimeout(r, 50))
    expect(settled, '🔴 十秒內沒回來 ⟹ 工作階段沒有看 maxSteps').toMatchObject({ kind: 'failed', error: { i18nKey: 'RUNTIME_ERR_MAX_STEPS' } })
  }, 30_000)

  it('★ 正向錨點：步數夠的程式照常跑完（上限不是一律停）', async () => {
    const tree = lift(H + 'int main() {\n  int s = 0;\n  for (int i = 0; i < 100; i++) s = s + i;\n  cout << s;\n  return 0;\n}\n')
    const { s, out } = openCella(p, tree, { maxSteps: 50_000 })
    expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
    expect(out()).toBe('4950')
  }, 30_000)

  it('讀輸入：停在 awaiting-input，給一行之後繼續、印出讀到的值', async () => {
    const tree = lift(H + 'int main() {\n  int n;\n  cin >> n;\n  cout << n;\n  return 0;\n}\n')
    const { s, out } = openCella(p, tree)
    expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    expect(await s.supplyInput('7')).toEqual({ kind: 'ended' })
    expect(out()).toBe('7')
  })
})
