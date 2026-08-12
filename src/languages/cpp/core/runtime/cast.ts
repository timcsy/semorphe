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
