/**
 * **字元的執行期表示** —— 一個與身分無關的演算法
 *
 * 從 `std/cctype/executors.ts` 提出來。三顆字元元件搬進膠囊之後那個檔會消失，
 * 而 `charOf` 是**它們共用的知識**，不屬於其中任何一顆。
 *
 * > **共用的是演算法，不是身分。**
 */
import type { RuntimeValue } from '../../../../interpreter/types'

/**
 * 從執行期值取出一個字元。
 *
 * ⚠️ **不能一律 `String(value).charAt(0)`。** 字元在這個直譯器裡可能以
 * 數字碼存放（陣列初始化列表就是這樣），那句會把 97 取成 `'9'`——
 * 於是 `isdigit('a')` 回傳真，而**程式跑完、印出東西、結果是錯的**。
 */
export function charOf(v: RuntimeValue): string {
  if (v.type === 'char') {
    const s = String(v.value)
    // 已經是字元就直接用；是數字碼就轉回字元
    return s.length === 1 && !/^\d$/.test(s) ? s : String.fromCharCode(Number(v.value))
  }
  if (typeof v.value === 'number') return String.fromCharCode(v.value)
  return String(v.value).charAt(0)
}

