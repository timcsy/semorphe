/**
 * `cpp:pin_attach` 的 **execute** 路——**它真的宣告了一個變數**。
 *
 * ## ⚠️ 為什麼不是 `skipPaths`
 *
 * 這顆看起來像「接線」這種宣告性的事，而**執行期它不是**：後面的
 * `digitalWrite(ledPin, HIGH)` 要查得到 `ledPin` 的值。
 * 跳過的話，直譯器會在下一行撞上「未宣告的變數」——
 * 而症狀出現在**別人身上**，不在這顆。
 *
 * > **一個宣告如果有人會去查它，那它就不是宣告性的。**
 *
 * ## 🔴 而它**不能**沿用常數宣告的執行器
 *
 * 第一版直接 `register('cpp:pin_attach', execVarDeclare)`，而那是錯的：
 * 那支執行器的值從 `children.initializer` 讀，**而這顆的值在
 * `properties.pin`**（積木上是一個數字欄位，不是一個插槽）。
 *
 * ```
 * const int ledPin = 13;   →  execVarDeclare  →  ledPin = 0    🔴 安靜地錯
 * ```
 *
 * ⚠️ 而它**不會報錯**：變數宣告成功了，只是值是型別預設值。
 * 症狀要等到 `digitalWrite(ledPin, HIGH)` 點亮**腳位 0** 才出現，
 * 而在模擬環境裡那看起來就只是「另一根腳位」。
 *
 * > **沿用一支執行器之前，要問的不是「語義像不像」，
 * > 是「它從哪裡讀值，而我把值放在哪裡」。**
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:pin_attach', async (node, ctx) => {
    // ⚠️ **這裡刻意沒有 `?? 預設值`**——參數規格一致性護欄在看：
    //    一個與宣告的 `default` 不同的退路，等於同一件事有兩份真相。
    //    而更根本的是：判不出來就丟錯，不要回 0（第三十三條護欄）——
    //    一根「腳位 0」在 Arduino 上是真的存在的腳位，錯得看不出來。
    const rawName = node.properties.name
    const rawPin = node.properties.pin
    const pin = Number(rawPin)
    if (typeof rawName !== 'string' || rawName.length === 0 || !Number.isFinite(pin)) {
      throw new Error(`接線積木少了名字或腳位：name=${String(rawName)}, pin=${String(rawPin)}`)
    }
    ctx.scope.declare(rawName, { type: 'int', value: pin })
  })
}
