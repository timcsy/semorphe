/**
 * **執行工作階段的契約**（spec 183 T002）——每個宣告了 `session` 的提供者都跑同一組。
 *
 * 形狀照 DAP（`core/capabilities.ts` 的 `ExecutionSession`）：宿主下指令，每個指令回 `Outcome`。
 * 控制器只靠這一組行為；一個提供者過不了其中一條，控制器在那條路上就會壞。
 *
 * 🔴 **spec 205（重構 6c-3）盤點過**：每一條都對兩個提供者各跑一次（`PROVIDERS` 的迴圈）——**沒有只對 JS 跑的條目**，
 * 所以 Cella 那一格已經涵蓋整份契約（C++ 十條、Python 五條）。JS 那一格刻意留著：JS 提供者還登記在產品裡，
 * 要等 Cella 修好堆疊溢位（本檔最後一條）才拿（spec 205 的 US4）；拿掉的那一刀把 `PROVIDERS` 的第一筆刪掉即可。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { jsInterpreterProvider } from '../../src/providers/js-interpreter'
import { createCellaProvider } from '../../src/providers/cella/provider'
import { SessionStop, type ExecutionSession, type Provider } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'
import { liftPython } from '../helpers/python-lift'
import { cellaProvider, waitSession, until } from '../helpers/cella-session'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

/**
 * **Cella 提供者，worker 原地跑**——不 mock 判決或工作階段（`tests/helpers/cella-session.ts`；spec 205 起與其他執行相關的測試共用同一份，
 * 編好的模組走產品的建置路 `fetchPrecompiled`，不再每次現場編）。第一次 createSession 會讓 worker 開始準備除錯模組（R4），準備好之前它不接。
 */
async function cellaInProcess(): Promise<Provider> {
  const p = await cellaProvider()
  await waitSession(p, lift(LOOP))
  return p
}

const formalOf = (tree: SemanticNode) => ({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main' })
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const find = (t: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode | undefined => {
  if (pred(t)) return t
  for (const k of Object.values(t.slots ?? {})) for (const c of k) { const r = find(c, pred); if (r) return r }
  return undefined
}

let cellaShared: Promise<Provider> | null = null

const PROVIDERS: { id: string; make: () => Provider | Promise<Provider> }[] = [
  { id: 'js-interpreter', make: () => jsInterpreterProvider },
  // ⚠️ 同一個行程裡只能有一個模擬的 worker——C++ 與 Python 兩組共用同一個提供者
  { id: 'cella', make: () => (cellaShared ??= cellaInProcess()) },
]

function open(p: Provider, tree: SemanticNode): { s: ExecutionSession; out: () => string } {
  const s = p.createSession!({ maxSteps: 1_000_000, formal: formalOf(tree) }, tree)
  if ('declined' in s) throw new Error(`${p.id} 不接：${s.declined}`)
  let text = ''
  s.onOutput((t) => { text += t })
  return { s, out: () => text }
}

const LOOP = '#include <iostream>\nusing namespace std;\nint main() {\n  int s = 0;\n  for (int i = 0; i < 4; i++) {\n    s = s + i;\n  }\n  cout << s << endl;\n  return 0;\n}\n'
const READ = '#include <iostream>\nusing namespace std;\nint main() {\n  int n;\n  cin >> n;\n  cout << n * 2 << endl;\n  return 0;\n}\n'
const DIV0 = '#include <iostream>\nusing namespace std;\nint main() {\n  int a = 1;\n  int b = 0;\n  cout << a / b << endl;\n  return 0;\n}\n'

for (const entry of PROVIDERS) {
  describe(`執行工作階段的契約：${entry.id}`, () => {
    let p: Provider
    beforeAll(async () => { p = await entry.make() }, 400_000)

    it('★ 沒有中斷點：launch 一路跑完，輸出正確', async () => {
      const tree = lift(LOOP)
      const { s, out } = open(p, tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 中斷點：停在那一顆、看得到變數；continue 跑完', async () => {
      const tree = lift(LOOP)
      const target = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([target.id])
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: target.id } })
      expect(s.variables().find((v) => v.name === 's')?.value, '🔴 停下來而變數面板是空的').toBe('6')
      expect(s.environment(), '不是板子上的程式 ⟹ 沒有板子狀態（spec 185）').toBeNull()
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('🔴 中斷點設在運算式敘述（函式呼叫）上：會停、回報的是語義樹的 id（Cella 那側的標籤是 `<id>/stmt`）', async () => {
      const tree = lift('#include <iostream>\nusing namespace std;\nvoid f() {\n  cout << 1;\n}\nint main() {\n  int x = 2;\n  f();\n  cout << x;\n  return 0;\n}\n')
      const call = find(tree, (n) => n.componentId === 'cpp:func_call')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([call.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: call.id } })
      expect(out(), '停在呼叫之前，f 還沒印').toBe('')
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('12')
    })

    it('🔴 中斷點設在迴圈裡的指定敘述上：停在第一次、變數在（不能停在拿不到呼叫框的運算式上）', async () => {
      const tree = lift(LOOP)
      const assign = find(tree, (n) => n.componentId === 'cpp:var_assign')!
      const { s } = open(p, tree)
      s.setBreakpoints([assign.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: assign.id } })
      expect(Object.fromEntries(s.variables().map((v) => [v.name, v.value]))).toMatchObject({ s: '0', i: '0' })
    })

    it('🔴 覆蓋（spec 194）：一次跑完，迴圈身體的指定敘述進入 4 次、印出那一句 1 次；鍵是語義樹的 id', async () => {
      const tree = lift(LOOP)
      const assign = find(tree, (n) => n.componentId === 'cpp:var_assign')!
      const print = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s } = open(p, tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      const cov = s.coverage()
      expect(cov, '🔴 給不出覆蓋（Cella 的除錯模組沒有匯出 stopVisits？）').not.toBeNull()
      expect(cov!.get(assign.id), '迴圈跑 4 圈').toBe(4)
      expect(cov!.get(print.id)).toBe(1)
      expect([...cov!.keys()].every((k) => !k.includes('/')), '鍵是語義樹的 id，不是 Cella 的標籤').toBe(true)
    })

    it('★ 單步：stopOnEntry 停在第一步，每次 stepIn 往前一顆，最後跑完', async () => {
      const tree = lift(LOOP)
      const { s, out } = open(p, tree)
      let o = await s.launch(tree, { stopOnEntry: true })
      // 第一個停點叫 entry（DAP）或 step 都可以——控制器兩者一視同仁
      expect(o.kind === 'stopped' && ['entry', 'step'].includes(o.stop.reason), JSON.stringify(o)).toBe(true)
      const seen: string[] = []
      let guard = 0
      while (o.kind === 'stopped' && guard++ < 500) { seen.push(o.stop.nodeId ?? ''); o = await s.stepIn() }
      expect(seen.filter((id) => /[/#]/.test(id)), '🔴 停點回報的要是語義樹的 id，不是提供者自己的標籤').toEqual([])
      expect(o).toEqual({ kind: 'ended' })
      expect(new Set(seen).size, '單步應該經過好幾顆不同的節點').toBeGreaterThan(3)
      expect(out()).toBe('6\n')
    })

    it('★ 讀輸入：停在 awaiting-input，給了一行之後繼續', async () => {
      const tree = lift(READ)
      const { s, out } = open(p, tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
      expect(await s.supplyInput('21')).toEqual({ kind: 'ended' })
      expect(out()).toBe('42\n')
      expect(s.recordedInputs()).toContainEqual({ kind: 'stdin', value: '21' })
    })

    it('★ 改變數：停著改值，繼續之後的輸出反映它，而且留下紀錄', async () => {
      const tree = lift(LOOP)
      const target = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([target.id])
      await s.launch(tree, { stopOnEntry: false })
      expect(await s.setVariable('s', '100')).toBe(true)
      await s.continue()
      expect(out()).toBe('100\n')
      expect(s.recordedInputs().some((i) => i.kind === 'set-variable')).toBe(true)
    })

    it('★ 執行期錯誤：failed，帶 SessionStop（控制器只認這一種）', async () => {
      const tree = lift(DIV0)
      const { s } = open(p, tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o.kind).toBe('failed')
      if (o.kind === 'failed') {
        expect(o.error).toBeInstanceOf(SessionStop)
        expect(o.error.kind).toBe('runtime')
      }
    })

    it('🔴 停著時 terminate：下一個指令不會卡住，回 aborted', async () => {
      const tree = lift(LOOP)
      const { s } = open(p, tree)
      await s.launch(tree, { stopOnEntry: true })
      s.terminate()
      const o = await s.continue()
      expect(o.kind === 'ended' || (o.kind === 'failed' && o.error.kind === 'aborted'), JSON.stringify(o)).toBe(true)
    })
  })
}

// ─── Python（spec 195b）：同一份契約，Python 的程式 ───────────────────────────
const PY_LOOP = 's = 0\nfor i in range(4):\n    s = s + i\nprint(s)\n'
const PY_READ = 'n = int(input())\nprint(n * 2)\n'
const PY_ERR = 'a = 1\nb = 0\nprint(a // b)\n'
const pyFormal = (tree: SemanticNode) => ({ tree, targetId: 'python', styleId: 'python', skeletonId: 'none' })
async function liftPy(code: string): Promise<SemanticNode> { return (await liftPython(code))! }

for (const entry of PROVIDERS) {
  describe(`執行工作階段的契約（Python）：${entry.id}`, () => {
    let p: Provider
    const openPy = (tree: SemanticNode): { s: ExecutionSession; out: () => string } => {
      const s = p.createSession!({ maxSteps: 1_000_000, formal: pyFormal(tree) as never }, tree)
      if ('declined' in s) throw new Error(`${p.id} 不接：${s.declined}`)
      let text = ''
      s.onOutput((t) => { text += t })
      return { s, out: () => text }
    }
    beforeAll(async () => {
      p = await entry.make()
      // Cella：第一次 createSession 會開始編 Python 的除錯模組，編好之前它不接
      const tree = await liftPy(PY_LOOP)
      await until(() => !('declined' in p.createSession!({ maxSteps: 1, formal: pyFormal(tree) as never }, tree)), 300_000)
    }, 600_000)

    it('★ 沒有中斷點：一路跑完，輸出正確', async () => {
      const tree = await liftPy(PY_LOOP)
      const { s, out } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 中斷點：停在 print、看得到 s；繼續跑完', async () => {
      const tree = await liftPy(PY_LOOP)
      const target = find(tree, (n) => n.componentId === 'python:print')!
      const { s, out } = openPy(tree)
      s.setBreakpoints([target.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: target.id } })
      expect(s.variables().find((v) => v.name === 's')?.value).toBe('6')
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 讀輸入：停在 awaiting-input，給了一行之後繼續', async () => {
      const tree = await liftPy(PY_READ)
      const { s, out } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
      expect(await s.supplyInput('21')).toEqual({ kind: 'ended' })
      expect(out()).toBe('42\n')
    })

    it('★ 執行期錯誤（ZeroDivisionError）：failed，帶 SessionStop', async () => {
      const tree = await liftPy(PY_ERR)
      const { s } = openPy(tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o.kind, JSON.stringify(o)).toBe('failed')
      if (o.kind === 'failed') expect(o.error).toBeInstanceOf(SessionStop)
    })

    it('🔴 覆蓋：迴圈身體的指定敘述進入 4 次；鍵是語義樹的 id', async () => {
      const tree = await liftPy(PY_LOOP)
      const assign = find(tree, (n) => n.componentId === 'python:var_assign' && JSON.stringify(n).includes('"i"'))!
      const { s } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      const cov = s.coverage()
      expect(cov, '給不出覆蓋').not.toBeNull()
      expect(cov!.get(assign.id)).toBe(4)
    })
  })
}

/**
 * spec 205（重構 6c-3）：學生按執行走的是工作階段——切換之前先量它在兩種情況下給學生什麼。
 * ① 執行到一半出錯：出錯前印的要看得到（判決那條路的 `out` 在 reject 時是空的，工作階段這條路不是）。
 * ② 長輸出：🟡 Cella 0.1.202611020258 印到 6666 字就爆 wasm 的堆疊（已回報，擋切換）——修好那天這條會紅：改成斷言 8000 字整段跑完、解除 6c-3 的阻斷。
 */
describe('執行工作階段：切換前要知道的兩件事（Cella）', () => {
  let p: Provider
  beforeAll(async () => { p = await (cellaShared ??= cellaInProcess()) }, 400_000)

  it('★ 執行到一半出錯：出錯前的輸出看得到，停下的原因是中文的鍵、指回那一顆', async () => {
    const tree = lift('#include <iostream>\nusing namespace std;\nint main() {\n  int d;\n  cout << "before" << endl;\n  cin >> d;\n  cout << 10 / d << endl;\n  return 0;\n}\n')
    const { s, out } = open(p, tree)
    expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    const o = await s.supplyInput('0')
    expect(o).toMatchObject({ kind: 'failed', error: { i18nKey: 'RUNTIME_ERR_UB_DIV_ZERO' } })
    expect((o as { error: { nodeId: string | null } }).error.nodeId, '要指回那一顆，學生才知道是哪一行').toBeTruthy()
    expect(out(), '出錯前印的不得消失').toBe('before\n')
  }, 120_000)

  /**
   * 長輸出：🔴 **結果取決於那台機器的堆疊大小**（2026-11-02 量到）——本機 macOS 的 Node 印到 6666 字就爆 Cella 的 wasm 堆疊，
   * CI 的 Linux 整段跑完。所以這條不綁在某一台機器上：只准兩種結果——整段印完，或停在「輸出太長」（中文、說得出原因）；
   * 落到「說不出為什麼」或別的原因都是紅。學生的瀏覽器會是哪一種還沒量（切換前要量，spec 205 T008）。
   */
  it('長輸出（8000 字）：整段印完，或停在「輸出太長」——不得是「說不出為什麼」', async () => {
    const tree = lift('#include <iostream>\nusing namespace std;\nint main() {\n  for (int i = 0; i < 8000; i++) cout << "x";\n  return 0;\n}\n')
    const s = p.createSession!({ maxSteps: 10_000_000, formal: formalOf(tree) }, tree)
    if ('declined' in s) throw new Error(`Cella 不接：${s.declined}`)
    let text = ''
    s.onOutput((t) => { text += t })
    const o = await s.launch(tree, { stopOnEntry: false })
    if (o.kind === 'ended') {
      expect(text.length, '跑完了就要整段印出').toBe(8000)
    } else {
      expect(o, '堆疊不夠的機器上要說得出是「輸出太長」').toMatchObject({ kind: 'failed', error: { i18nKey: 'RUNTIME_ERR_CELLA_TOO_DEEP' } })
      expect(text.length).toBeLessThan(8000)
    }
  }, 300_000)
})
