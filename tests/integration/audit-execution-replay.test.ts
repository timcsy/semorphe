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
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  registerCppLanguage()
  await Parser.init({ locateFile: (n: string) => `${process.cwd()}/public/${n}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
})

const liftCppToSemantic = async (code: string): Promise<SemanticNode> => {
  const sem = lifter.lift(tsParser.parse(code)!.rootNode)
  expect(sem, '合成程式 lift 不出來 → 下面比的不是這支程式').not.toBeNull()
  return sem as SemanticNode
}

/** 一支會讀兩個數字並印出總和的程式——**合成的**，不是真實語料。 */
/** 一支跑到一半會撞到認不出來的東西的程式——**合成的**。 */
const HAS_UNKNOWN = `
#include <iostream>
using namespace std;
int main() {
  int total = 0;
  asm volatile("nop");
  total = total + 7;
  cout << total << endl;
  return 0;
}
`

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

async function runWith(
  tree: SemanticNode,
  typed: string[],
): Promise<{ out: string; asked: number; inputs: readonly unknown[] }> {
  const interp = new SemanticInterpreter({ maxSteps: 100_000 })
  let asked = 0
  const queue = [...typed]
  interp.setInputProvider(async () => { asked++; return queue.shift() ?? '\x04' })
  const out: string[] = []
  interp.setOutputCallback((t) => out.push(t))
  await interp.execute(tree as never)
  return { out: out.join(''), asked, inputs: interp.getRecordedInputs() }
}

describe('第七十六條護欄：同一份輸入，重播得到同一個答案', () => {
  it('★ 入口條件：這支測試真的餵了輸入進去', async () => {
    // ⚠️ 錨在**這支自己造的合成輸入筆數**上——它不隨任何缺陷被修好而變小。
    const tree = await liftCppToSemantic(SUM_TWO)
    const first = await runWith(tree, ['3', '4'])
    expect(first.asked, '一次都沒被問 → 這支沒有走到它要驗的路，下面的綠不算數')
      .toBe(2)
    expect(first.out.trim(), '合成程式本身要跑得對，否則下面比的是兩個錯的').toBe('7')
  })

  it('🔴 ① 人打的字要被記下來', async () => {
    const tree = await liftCppToSemantic(SUM_TWO)
    const { inputs } = await runWith(tree, ['3', '4'])
    expect(inputs, '打了兩個值而紀錄是空的 → 這次執行重現不出來').toEqual([
      { kind: 'stdin', value: '3' },
      { kind: 'stdin', value: '4' },
    ])
  })

  it('🔴 ② 拿那份紀錄重播 → 輸出逐字相同，而且【不再問人】', async () => {
    const tree = await liftCppToSemantic(SUM_TWO)
    const first = await runWith(tree, ['3', '4'])

    const replay = new SemanticInterpreter({ maxSteps: 100_000 })
    let askedAgain = 0
    replay.setInputProvider(async () => { askedAgain++; return '999' })
    const out: string[] = []
    replay.setOutputCallback((t) => out.push(t))
    replay.setReplayInputs(first.inputs as never)
    await replay.execute(tree as never)

    expect(out.join(''), '重播的輸出與第一次不同 → 那份紀錄沒有被用上').toBe(first.out)
    expect(askedAgain, '🔴 重播還在問人 → 它不是重播，是重跑').toBe(0)
  })

  it('🔴 ③ 人改的狀態也要被記下來——而它正是 2026-08-26 造出來的那個洞', async () => {
    // ⚠️ **走真的路徑**：跑到一顆認不出來的東西 → 暫停 → 手填 → 繼續。
    //    不用「直接對一個空的直譯器呼叫 setVariableFromHost」——
    //    那樣改不到任何變數（名字不在作用域裡），驗到的是失敗路徑。
    const tree = await liftCppToSemantic(HAS_UNKNOWN)
    const interp = new SemanticInterpreter({ maxSteps: 100_000 })
    const out: string[] = []
    interp.setOutputCallback((t) => out.push(t))
    interp.setUnknownComponentPause(async () => {
      interp.setVariableFromHost('total', '100')
      return 'continue'
    })
    await interp.execute(tree as never)

    expect(out.join('').trim(), '手填沒有生效 → 這支驗的不是那條路').toBe('107')
    expect(interp.getRecordedInputs()).toEqual([
      { kind: 'set-variable', name: 'total', value: '100' },
      { kind: 'pause-decision', decision: 'continue' },
    ])
  })

  it('🔴 ④ 手填過的那次執行，重播要得到【同一個】答案', async () => {
    // 這一條是整條規範的重點：`模擬的誠實` §① 說的正是這件事。
    const tree = await liftCppToSemantic(HAS_UNKNOWN)
    const first = new SemanticInterpreter({ maxSteps: 100_000 })
    const o1: string[] = []
    first.setOutputCallback((t) => o1.push(t))
    first.setUnknownComponentPause(async () => {
      first.setVariableFromHost('total', '100')
      return 'continue'
    })
    await first.execute(tree as never)

    const replay = new SemanticInterpreter({ maxSteps: 100_000 })
    const o2: string[] = []
    replay.setOutputCallback((t) => o2.push(t))
    let askedAgain = 0
    replay.setUnknownComponentPause(async () => { askedAgain++; return 'stop' })
    replay.setReplayInputs(first.getRecordedInputs())
    await replay.execute(tree as never)

    expect(o2.join(''), '🔴 重播沒有拿到同一個答案 → 那次執行重現不出來').toBe(o1.join(''))
    expect(askedAgain, '🔴 重播還在問人 → 它不是重播').toBe(0)
  })

  it('★ 反向：沒有人打過字的執行，紀錄要是空的（不得無中生有）', async () => {
    // 缺了這一條，一個「什麼都記」的實作也能通過上面幾條，
    // 而那會讓「這次執行有沒有人介入過」這個問題失去答案。
    const tree = await liftCppToSemantic('int main() { return 0; }')
    const { inputs } = await runWith(tree, [])
    expect(inputs).toEqual([])
  })
})
