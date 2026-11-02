/**
 * **執行覆蓋**：這一次跑到過哪些節點。
 *
 * 🔴 它守的是**回饋**，不是正確性——初學者的 bug 有壓倒性的比例是這兩種：
 * 「這一段從來沒跑到」與「跑的次數不對」，而這份資料是前者的來源。
 *
 * ⚠️ 而「沒到過」**不等於「錯」**：一個 `if` 的另一支本來就可能不該跑。
 * 所以它的用途是**問一句**，不是判對錯。
 *
 * ## spec 205（重構 6c-3）：來源換成 Cella 的工作階段
 *
 * 學生按執行走的是工作階段；跑完時控制器讀 `session.coverage()`（`execution-controller` 的 `finish`）。
 * Cella 的覆蓋是 `cella-lang/dap` 的 `coverage()`（spec 194）——標籤收回成語義樹的 id（`visitsByNode`）。
 * 原本這支對 `SemanticInterpreter.getVisitedNodes／getVisitCounts` 斷言；同樣的幾件事改問 Cella：
 *
 * ```
 * 記得到東西（入口條件）· 跑過的在 · 沒跑到的不在 · 次數記得住 · 每一次開跑都是新的
 * ```
 *
 * 🔴 **而「迴圈自己被走一次」那一條換了定義**：Cella 數的是「進入那顆節點幾次」——與 stepIn 停下的定義相同，
 * 迴圈的標籤每檢查一次條件就算一次（跑 3 圈 → 4 次；for、do-while 也一樣）。JS 直譯器數的是「迴圈敘述被執行幾次」（1 次）。
 * 產品的 `core/iterations.ts`（`loopRatio`／`iterationCounts`，迴圈徽章與「預測揭曉」）拿迴圈自己的次數當分母，
 * 是照 JS 的定義寫的——spec 205 T009 改成依工作階段宣告的 `loopCounts` 換算（見最後一條）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { cellaProvider, openCella, waitSession } from '../../helpers/cella-session'
import { loopRatio } from '../../../src/core/iterations'
import type { Provider } from '../../../src/core/capabilities'
import type { SemanticNode } from '../../../src/core/types'

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

const all = (t: SemanticNode, pred: (n: SemanticNode) => boolean, out: SemanticNode[] = []): SemanticNode[] => {
  if (pred(t)) out.push(t)
  for (const k of Object.values(t.slots ?? {})) for (const c of k) all(c, pred, out)
  return out
}
const printOf = (t: SemanticNode, text: string): SemanticNode =>
  all(t, (n) => n.componentId === 'cpp:print' && JSON.stringify(n).includes(`"${text}"`))[0]

/** 跑完一次，回覆蓋（給不出就紅：產品那一側會說「沒有覆蓋資料」，而這支要驗的是給得出的那條路） */
async function coverageOf(tree: SemanticNode): Promise<ReadonlyMap<string, number>> {
  const { s } = openCella(p, tree)
  expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
  const cov = s.coverage()
  expect(cov, '🔴 給不出覆蓋（Cella 的除錯模組沒有匯出 stopVisits？）').not.toBeNull()
  return cov!
}

/** 一支 if 走不進去、一句一定走到 */
const BRANCHY = H + 'int main() {\n  int x = 1;\n  if (x > 5) {\n    cout << "never";\n  }\n  cout << "ran";\n  return 0;\n}\n'
/** while 跑 3 圈 */
const WHILE3 = H + 'int main() {\n  int i = 0;\n  while (i < 3) {\n    cout << "x";\n    i = i + 1;\n  }\n  return 0;\n}\n'

describe('執行覆蓋（Cella 工作階段）', () => {
  it('★ 入口條件：真的記到東西（0 個的話下面每一條都是空轉）', async () => {
    const cov = await coverageOf(lift(BRANCHY))
    expect(cov.size).toBeGreaterThan(1)
  })

  it('跑過的節點會被記下來（鍵是語義樹的 id）', async () => {
    const tree = lift(BRANCHY)
    const cov = await coverageOf(tree)
    expect(cov.get(printOf(tree, 'ran').id)).toBe(1)
  })

  it('🔴 沒走到的不在裡面——這就是「這一段從來沒被跑到」的來源', async () => {
    // 原本的寫法是「一顆沒掛進樹裡的節點」；工作階段跑的是整棵樹，對應的是【在樹裡而沒走到】的那一支
    const tree = lift(BRANCHY)
    const cov = await coverageOf(tree)
    const never = printOf(tree, 'never')
    expect(never, '前提：那一句在樹裡').toBeDefined()
    expect(cov.has(never.id), '🔴 沒走進去的分支被記成跑過').toBe(false)
    expect(cov.get(printOf(tree, 'ran').id)).toBe(1)
  })

  it('★ 次數也記得住——「迴圈跑了幾次」的原料', async () => {
    const tree = lift(WHILE3)
    const cov = await coverageOf(tree)
    expect(cov.get(printOf(tree, 'x').id), '🔴 身體跑 3 圈').toBe(3)
    const w = all(tree, (n) => n.componentId === 'cpp:loop_while')[0]
    // Cella 的定義：迴圈的標籤每檢查一次條件算一次（3 次進身體 ＋ 1 次讓它停下來的）——見檔頭
    expect(cov.get(w.id), '迴圈自己：條件檢查的次數').toBe(4)
  })

  it('🔴 每一次開跑都是新的——不清的話「沒跑到的」會越來越少，次數會越疊越多', async () => {
    const tree = lift(WHILE3)
    const body = printOf(tree, 'x')
    const first = await coverageOf(tree)
    const second = await coverageOf(tree)
    expect(first.get(body.id)).toBe(3)
    expect(second.get(body.id), '🔴 上一次的次數疊進這一次裡').toBe(3)
    // 換一支程式：上一支的節點不得出現在這一次的覆蓋裡
    const third = await coverageOf(lift(BRANCHY))
    expect(third.has(body.id), '🔴 上一次的殘留在這一次裡').toBe(false)
  })

  /**
   * 🟢 spec 205 T009 修好（原本是 knownCellaGap 的釘子）：迴圈徽章與「預測揭曉」的 `loopRatio` 原本把迴圈自己的次數當分母（JS 的定義：1），
   * Cella 給的是條件檢查的次數（4）⟹ floor(3／4)＝0，學生猜 3 圈、畫面說 0 圈。
   * 修法：工作階段自己說次數是哪一種（`loopCounts`），`core/iterations.ts` 依它換算（Cella：進入次數＝迴圈次數－圈數）。
   */
  it('🔴 用 Cella 的覆蓋算「迴圈跑了幾圈」：照工作階段宣告的計數方式換算，是 3 不是 0', async () => {
    const tree = lift(WHILE3)
    const { s } = openCella(p, tree)
    expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
    expect(s.loopCounts, 'Cella 的工作階段要說出它數的是條件檢查').toBe('checks')
    const w = all(tree, (n) => n.componentId === 'cpp:loop_while')[0]
    expect(loopRatio(w, s.coverage()!, s.loopCounts)).toBe(3)
    // 對照：照 JS 的定義去除就是那個缺陷的樣子
    expect(loopRatio(w, s.coverage()!, 'entries')).toBe(0)
  })
})
