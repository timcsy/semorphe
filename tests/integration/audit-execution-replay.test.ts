/**
 * **第七十六條護欄**：同一份輸入，重播得到同一個答案。
 *
 * ## 它從哪來
 *
 * `concepts/模擬的誠實.md:23` 是這個專案關於執行的第一條規則，逐字：
 *
 * > **一個每次讀到不同值的模擬器，測不出任何東西。**
 *
 * `:25` 說得更硬：
 *
 * > 🔴 **模擬一律不模那些**——它們讓「同一支程式跑兩次結果不同」，
 * >  而那會讓**每一條測試都變成偶然**。
 *
 * 🔴 **而 2026-08-26 我們自己造了一個那樣的東西**：那天下午讓使用者在暫停時
 * **手填執行期變數**（`setVariableFromHost`），而那個值**直接落進 `scope`，
 * 沒有進任何紀錄**。於是同一支程式跑兩次會得到不同答案。
 *
 * ⚠️ 它與 `analogRead` 抖動的差別只在「**要有人按按鈕才會發生**」
 * ——而那不是一個原則上的差別。
 *
 * ## 這條護欄量什麼
 *
 * ```
 * ① 不可重現的輸入【都被記下來】   人打的字（awaitInput）· 人改的狀態（setVariableFromHost）
 * ② 拿那份紀錄重播 → 輸出【逐字相同】，而且【不再問人】
 * ```
 *
 * ⚠️ **`io.read()` 那條不算**：它讀的是**跑之前就排好的佇列**
 * （`io.ts` 的 `stdinQueue`），本身就是一份紀錄，本來就重現得出來。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果重播那一支根本沒有消費到任何一筆紀錄（`consumed === 0`），
 * > 代表這支測試沒有走到它要驗的路，這份綠燈不算數——
 * > 不是「重播是對的」。**
 *
 * 錨在**餵進去的合成輸入筆數**上（第 9 步的入口條件）：
 * 它是這支測試自己造的，🔴 **刻意不錨在「還有幾個沒記的來源」**
 * ——那正是要推向零的（`build-guardrail` 第 2 步，這個 repo 犯過九次）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 `rand`／時鐘**——`模擬的誠實` §① 逐字「模擬一律不模那些」，
 *   它們**根本不該有隨機性可記**。哪天有了，那是那一條的缺陷，不是這一條。
 * - **不檢測重播的 UI**（主控台標不標得出「這是重播的」）——那是視圖的事。
 * - **不檢測「紀錄存到哪」**（存檔／匯出）——這一刀只到記憶體裡的一次執行。
 * - ⚠️ **不檢測「人改的東西合不合理」**——重播只保證**重現**，不保證正確。
 *   一個把 `total` 改成 100 的執行，重播還是 100。**那是誠實，不是背書。**
 *
 * ## spec 205（重構 6c-3）：接手的是 Cella 的工作階段
 *
 * Cella 提供者宣告了 「session: { setInput: true, setVariable: true }」，工作階段有 `supplyInput`、`setVariable`、`recordedInputs`
 * （`src/providers/cella/provider.ts`）。重播照產品的做法（`execution-controller` 的 `replayLast`）：上一次的 stdin 排成佇列，
 * 每一次 `awaiting-input` 先從佇列拿，拿不到才問人。
 *
 * ```
 * ① 人打的字被記下來                ✅ Cella
 * ② 拿紀錄重播 → 同樣輸出、不再問人   ✅ Cella（佇列照產品的 replayLast）
 * ③ 人改的狀態被記下來              ✅ Cella（停在中斷點 → setVariable）
 * ④ 人改的狀態重播得到同一個答案      🟡 今天沒有——見那一條
 * ```
 *
 * ⚠️ ③ 原本走「跑到認不出來的東西 → 暫停 → 手填 → 繼續」（`setUnknownComponentPause`、紀錄裡多一筆 `pause-decision`）。
 * Cella 那一側**沒有那條路**：認不出的東西整支不送（`unknown-component-stops.test.ts`）——改走「停在中斷點 → 手填」，
 * 它是 Cella 唯一能改值的時機（`setVariable` 只在停下時）。`pause-decision` 那一筆隨那條路一起退場。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { cellaProvider, openCella, waitSession } from '../helpers/cella-session'
import type { ExecutionSession, Outcome, Provider, SessionInput } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
let p: Provider

const liftCpp = (code: string): SemanticNode => {
  const sem = createTestLifter().lift(parser.parse(code)!.rootNode as never)
  expect(sem, '合成程式 lift 不出來 → 下面比的不是這支程式').not.toBeNull()
  return sem as SemanticNode
}

beforeAll(async () => {
  registerCppLanguage()
  await Parser.init({ locateFile: (n: string) => `${process.cwd()}/public/${n}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  p = await cellaProvider()
  await waitSession(p, liftCpp('int main() { return 0; }'))
}, 400_000)

/** 一支會讀兩個數字並印出總和的程式——**合成的**，不是真實語料。 */
const SUM_TWO = `
#include <iostream>
using namespace std;
int main() {
  int a; int b;
  cin >> a;
  cin >> b;
  cout << a + b << endl;
  return 0;
}
`

/** 一支在中途停下來讓人改值的程式——**合成的**（停點是 「total = total + 7;」 那一句）。 */
const EDITABLE = `
#include <iostream>
using namespace std;
int main() {
  int total = 0;
  total = total + 7;
  cout << total << endl;
  return 0;
}
`

/**
 * 跑到底：每一次 `awaiting-input`，先從佇列拿（重播），拿不到才問人（`ask`，計次）。
 * 與產品同形：`replayLast` 把上一次的 stdin 排進主控台的佇列，`awaiting-input` 時照常被讀。
 */
async function drive(
  s: ExecutionSession, tree: SemanticNode, queue: string[], ask: () => string,
): Promise<{ asked: number; outcome: Outcome }> {
  let asked = 0
  let o = await s.launch(tree, { stopOnEntry: false })
  while (o.kind === 'stopped' && o.stop.reason === 'awaiting-input') {
    const line = queue.length > 0 ? queue.shift()! : (asked++, ask())
    o = await s.supplyInput(line)
  }
  return { asked, outcome: o }
}

async function runWith(tree: SemanticNode, typed: string[]): Promise<{ out: string; asked: number; inputs: readonly SessionInput[] }> {
  const { s, out } = openCella(p, tree)
  const rest = [...typed]
  const { asked, outcome } = await drive(s, tree, [], () => rest.shift() ?? '')
  expect(outcome, '合成程式要跑完').toEqual({ kind: 'ended' })
  return { out: out(), asked, inputs: s.recordedInputs() }
}

/** 停在 「total = total + 7;」，把 total 改成 100，繼續跑完 */
async function runEdited(tree: SemanticNode): Promise<{ out: string; inputs: readonly SessionInput[] }> {
  const target = (tree.slots.body ?? []).flatMap(function walk(n: SemanticNode): SemanticNode[] {
    return [n, ...Object.values(n.slots ?? {}).flat().flatMap(walk)]
  }).find((n) => n.componentId === 'cpp:var_assign')!
  const { s, out } = openCella(p, tree)
  s.setBreakpoints([target.id])
  expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: target.id } })
  expect(await s.setVariable('total', '100'), '改不了值 → 這支驗的不是那條路').toBe(true)
  expect(await s.continue()).toEqual({ kind: 'ended' })
  return { out: out(), inputs: s.recordedInputs() }
}

describe('第七十六條護欄：同一份輸入，重播得到同一個答案（Cella 工作階段）', () => {
  it('★ 入口條件：這支測試真的餵了輸入進去', async () => {
    // ⚠️ 錨在**這支自己造的合成輸入筆數**上——它不隨任何缺陷被修好而變小。
    const first = await runWith(liftCpp(SUM_TWO), ['3', '4'])
    expect(first.asked, '一次都沒被問 → 這支沒有走到它要驗的路，下面的綠不算數').toBe(2)
    expect(first.out.trim(), '合成程式本身要跑得對，否則下面比的是兩個錯的').toBe('7')
  })

  it('🔴 ① 人打的字要被記下來', async () => {
    const { inputs } = await runWith(liftCpp(SUM_TWO), ['3', '4'])
    expect(inputs, '打了兩個值而紀錄是空的 → 這次執行重現不出來').toEqual([
      { kind: 'stdin', value: '3' },
      { kind: 'stdin', value: '4' },
    ])
  })

  it('🔴 ② 拿那份紀錄重播 → 輸出逐字相同，而且【不再問人】', async () => {
    const tree = liftCpp(SUM_TWO)
    const first = await runWith(tree, ['3', '4'])
    const replayQueue = first.inputs.filter((i): i is Extract<SessionInput, { kind: 'stdin' }> => i.kind === 'stdin').map((i) => i.value)
    const { s, out } = openCella(p, tree)
    const { asked, outcome } = await drive(s, tree, replayQueue, () => '999')
    expect(outcome).toEqual({ kind: 'ended' })
    expect(out(), '重播的輸出與第一次不同 → 那份紀錄沒有被用上').toBe(first.out)
    expect(asked, '🔴 重播還在問人 → 它不是重播，是重跑').toBe(0)
  })

  it('🔴 ③ 人改的狀態也要被記下來——而它正是 2026-08-26 造出來的那個洞', async () => {
    // ⚠️ **走真的路徑**：停下 → 手填 → 繼續（不是對一個沒開跑的工作階段改值——那樣改不到任何變數，驗到的是失敗路徑）
    const { out, inputs } = await runEdited(liftCpp(EDITABLE))
    expect(out.trim(), '手填沒有生效 → 這支驗的不是那條路').toBe('107')
    expect(inputs).toEqual([{ kind: 'set-variable', name: 'total', value: '100' }])
  })

  /**
   * 🟡 **今天沒有（修好時這條會紅）**：手填過的那次執行，重播得不到同一個答案。
   *
   * - Cella 工作階段的紀錄只有 「{ kind, name, value }」——**沒有「在第幾次停下時改的」**，重播不知道該在哪裡套用；
   *   `cella-lang/dap` 自己的 `trace()` 有 `afterStop`，但只記 stdin 與環境輸入，**不記 setVariable**（Cella 未支援）。
   * - 產品因此照實不重播它：`replayLast` 只重播 stdin，並說「這次重播沒有包含你手動改的 n 筆」（`REPLAY_SKIPPED`）——P6 的誠實，不是靜默。
   *
   * 這裡斷言今天的狀態：紀錄沒有位置、只重播 stdin 的那一次得到的是程式自己的答案（7），不是手填過的（107）。
   * 修好的那天（紀錄帶位置、重播在同一個停點套用）第一個斷言會紅——那時改成「重播得到 107、而且不再問人」。
   */
  it('🟡 ④ 手填過的那次執行，重播今天得不到同一個答案（紀錄沒有位置；產品照實說沒重播）', async () => {
    const tree = liftCpp(EDITABLE)
    const first = await runEdited(tree)
    const edit = first.inputs.find((i) => i.kind === 'set-variable')!
    expect(Object.keys(edit).sort(), '🟢 紀錄開始帶「在哪裡改的」⟹ 改成真的重播並斷言同一個答案').toEqual(['kind', 'name', 'value'])
    const replay = await runWith(tree, [])
    expect(first.out.trim()).toBe('107')
    expect(replay.out.trim(), '只重播 stdin：拿到的是程式自己的答案').toBe('7')
  })

  it('★ 反向：沒有人打過字的執行，紀錄要是空的（不得無中生有）', async () => {
    // 缺了這一條，一個「什麼都記」的實作也能通過上面幾條，
    // 而那會讓「這次執行有沒有人介入過」這個問題失去答案。
    const { inputs } = await runWith(liftCpp('int main() { return 0; }'), [])
    expect(inputs).toEqual([])
  })
})
