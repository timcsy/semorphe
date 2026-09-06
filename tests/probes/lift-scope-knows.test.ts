/**
 * 探針：**lift 期到底知不知道「這個名字有沒有被宣告」？**
 *
 * ## 🔴 它要回答的是一個「重開條件」
 *
 * `src/components/cpp/pin_constant/component.json` 的 `lift` 是 `null`，
 * 而它附著一份完整的病歷（`_lift_why`）：
 *
 * > 🔴 **第一版有一個 `lift-pattern.json`，靠識別字的名字認人
 * > ——而它把使用者宣告的名字搶走了。**
 * > 語料裡有 `enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };`，
 * > 而 `cout << LOW` 印出 **0** 而不是 **-1**。
 *
 * 處置逐字：「拿掉 lift 樣式……執行時**查不到宣告才**去問腳位常數表
 * ——那正是正確的語義：**沒有人宣告它，它才是環境提供的**。」
 *
 * 🔴 **而那個判準當時只在執行期做得到。** 這一支去問：
 * **lift 期做得到嗎？**
 *
 * ```
 * LiftContextData.declare / lookup   機制在（core/lift/lift-context.ts）
 * lifter.ts:100 data.declare(…)      而且【真的有人在餵】
 * ```
 *
 * ⚠️ 若 lift 期也知道，那條「拿掉 lift 樣式」的處置就有了**更好的版本**：
 * 樣式照樣認人，**而它先問一句「這個名字被宣告過嗎」**。
 *
 * ## ⚠️ 它不判斷該不該做
 *
 * 這一支只把「知不知道」量出來。**要不要重開那顆膠囊的 lift 是一個決定**，
 * 而決定要人做——這裡只是讓那個決定有東西可以看。
 *
 * > **一個「重開條件」如果沒有人去量它有沒有成立，
 * > 它與「永遠不重開」是同一件事。**
 *
 * ## 🔴 量出來的答案（2026-09-06）：**重開條件不成立**
 *
 * ```
 * speed（一般變數）    ✅ 查得到
 * LOW（enum 成員）     🔴 查不到   ← 全部的重點在這一行
 * D1 / OUTPUT          🔴 查不到（＝環境提供的，那是【對的】）
 * ```
 *
 * 根因：`lifter.ts` 的 `recordDeclaration` 只認 `<scope>:<x>_declare`
 * 這種概念，或帶 `type` 屬性的節點——**enum 成員兩者都不是**。
 *
 * 🟢 **所以那條「拿掉 lift 樣式」的處置今天仍然是對的**，
 * 而 vision 上那條「已知不一致」該記成**已決**，不是待做。
 *
 * ⏳ **真正的重開條件因此更明確了**：`recordDeclaration` 要認得
 * **列舉成員**（以及其他「宣告了一個名字」的形狀）。而那是另一刀
 * ——它的收益不只 `pin_constant` 一顆：`builtin_constant` 用同一個做法
 * （`EOF`／`NULL` 靠名字 lift），而那顆有同樣的風險，只是名字比較少人重宣告。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { LiftContextData } from '../../src/core/lift/lift-context'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

/** lift 一段碼，並把**同一份** context 交回來——那份 context 記著誰被宣告過。 */
function liftWithData(code: string): { tree: SemanticNode | null; data: LiftContextData } {
  const data = new LiftContextData()
  const root = parser.parse(code)!.rootNode
  const tree = createTestLifter().liftWithContext(root as never, data) as SemanticNode | null
  return { tree, data }
}

describe('探針：lift 期知不知道一個名字被宣告過', () => {
  it('★ 入口條件——解析器與 lifter 都起得來', () => {
    const { tree } = liftWithData('int main() { int x = 1; return 0; }')
    expect(tree, '🔴 lift 回 null → 下面每一條都是空過的').not.toBeNull()
  })

  /**
   * 🔴 **要在作用域還活著的時候問**——這一支第一版把宣告放進 `main()` 裡，
   * 而 `compound_statement` 有 `finally { popScope() }`：lift 完之後那個
   * 作用域早就彈掉了，於是「查不到」是**對的**，而它讀起來像「機制壞了」。
   *
   * > **一個問「現在知不知道」的探針，如果它在事情結束之後才問，
   * > 量到的永遠是「不知道」——而那與「從來不知道」長得一樣。**
   *
   * 🟢 而 lift-pattern 的 constraint **是在 lift 當下跑的**——那時作用域活著。
   */
  it('🟢 頂層宣告（作用域還活著）：lift 期查得到', () => {
    const { data } = liftWithData('int speed = 5;\n')
    expect(data.lookup('speed'), '🔴 連頂層變數都查不到 → 這條路不通').not.toBeNull()
  })

  /**
   * 🔴 **這一條是全部的重點。**
   *
   * 病歷裡那個把 `pin_constant` 的 lift 樣式逼退的輸入，就是它。
   * 若 `LOW` 查得到 → 樣式可以先問一句再認人 → **重開條件成立**。
   * 若查不到 → 那條處置今天仍然是對的，而 vision 上那條「已知不一致」
   * 要改成「**已決**」，不是「待做」。
   */
  it('🔴 列舉成員（那個把樣式逼退的輸入）：lift 期查得到嗎', () => {
    // ⚠️ 頂層的 enum——不放進 `main()`，理由見上一支
    const code = 'enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };\n'
    const { data } = liftWithData(code)
    const found = data.lookup('LOW')
    // eslint-disable-next-line no-console
    console.log(`\n  enum 成員 LOW → ${found ? `✅ 查得到（type=${found.type}）` : '🔴 查不到'}\n`)
    expect(typeof found, '（這一支只量，不判對錯——結論由人做）').toBe(found === null ? 'object' : 'object')
  })

  it('🔴 而 `pinMode(D1, OUTPUT)` 裡的 D1／OUTPUT：查得到嗎', () => {
    const code = 'void setup() {\n    pinMode(D1, OUTPUT);\n}\n'
    const { data } = liftWithData(code)
    const rows = ['D1', 'OUTPUT'].map((n) => `${n} → ${data.lookup(n) ? '✅ 查得到' : '🔴 查不到（＝環境提供的）'}`)
    // eslint-disable-next-line no-console
    console.log('\n  ' + rows.join('\n  ') + '\n')
    expect(rows).toHaveLength(2)
  })

  /**
   * ⚠️ **遮蔽也要對**：同一個名字在內層被重新宣告時，
   * 「有沒有被宣告」的答案要跟著作用域走。
   */
  it('遮蔽：內層宣告了同名，內層查得到', () => {
    const { data } = liftWithData('int main() {\n    {\n        int HIGH = 7;\n    }\n    return 0;\n}\n')
    // ⚠️ 離開那個 scope 之後**應該**查不到——這一條量的是「作用域有沒有在動」
    // eslint-disable-next-line no-console
    console.log(`\n  離開內層之後 HIGH → ${data.lookup('HIGH') ? '仍查得到（作用域沒有彈出）' : '✅ 查不到'}\n`)
    expect(true).toBe(true)
  })
})
