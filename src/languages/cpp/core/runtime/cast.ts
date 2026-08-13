/**
 * **轉型的執行語義** —— 一個與身分無關的演算法
 *
 * C 風格轉型與四種命名轉型在執行期做的事**是同一件**，而它們是五顆不同的元件。
 * 把它寫五份會漂移；讓四顆去 import 第五顆的 `execute.ts` 則是
 * **「五路實作是另一顆元件的別名」**——那顆就永遠搬不動。
 *
 * > **共用的是演算法，不是身分。** 演算法住在這裡，五顆各自宣告自己用它。
 *
 * ⚠️ 一個真實的差別：**C 風格轉型的 `char` 要回字元**（`(char)66` 印出 `B`），
 * 命名轉型的 `char` 回整數（既有行為，未經檢驗是否正確——保留，不在搬家的 diff 裡改）。
 */
import type { RuntimeValue } from '../../../../interpreter/types'

export function numericCast(
  targetType: string,
  val: RuntimeValue,
  num: number,
  opts: { charIsChar: boolean },
): RuntimeValue {
  // **無號型別要截斷**。`static_cast<unsigned char>(~0)` 是 255，不是 -1。
  //
  // ⚠️ 原本這些型別**一個都沒有被認出來**，於是落到尾端的 `return val`
  // ——原封不動回傳，而 `-1` 看起來就像一個成功的轉型結果。
  // 那與這個專案追的靜默降級同形：**沒做事與做對了在畫面上相同。**
  const UNSIGNED_BITS: Record<string, number> = {
    'unsigned char': 8,
    'unsigned short': 16,
    'unsigned': 32,
    'unsigned int': 32,
    'unsigned long': 32,
    'unsigned long long': 32,
  }
  const bits = UNSIGNED_BITS[targetType.trim()]
  if (bits !== undefined) {
    // ⚠️ 32 位用 `>>> 0`（JS 的位元運算就是 32 位）；更窄的用遮罩。
    const truncated = bits === 32 ? Math.trunc(num) >>> 0 : Math.trunc(num) & ((1 << bits) - 1)
    return { type: 'int', value: truncated }
  }

  if (targetType === 'char') {
    return opts.charIsChar
      ? { type: 'char', value: String.fromCharCode(Math.trunc(num)) }
      : { type: 'int', value: Math.trunc(num) }
  }
  if (targetType === 'int' || targetType === 'long' || targetType === 'short') {
    return { type: 'int', value: Math.trunc(num) }
  }
  if (targetType === 'double' || targetType === 'float') {
    return { type: 'double', value: num }
  }
  return val
}
