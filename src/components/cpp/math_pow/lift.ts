/**
 * `cpp:math_pow` 的 **lift** 路
 *
 * ⚠️ **它原本住在一個「看起來像實作」的函式裡。**
 *
 * `std/cmath/lifters.ts` 的 `tryCmathLift()` 有 40 行、三個分支、
 * 自己組 `createNode`——看起來完全不像「一筆資料」。而拆開之後只剩：
 *
 * ```
 * pow      → cpp:math_pow    引數槽 base, exponent
 * 18 個名字 → cpp:math_unary  引數槽 value      ＋ func 屬性
 *  5 個名字 → cpp:math_binary 引數槽 arg1, arg2 ＋ func 屬性
 * ```
 *
 * > **一個函式長得像實作，不代表它是實作。**
 * > 判準：把它的分支排成表，每一列還剩下什麼？只剩資料 → 它是分派表。
 *
 * 那三列因此塞得進 `call-concepts` 這張已被第二顆膠囊驗證的表——
 * 只需要讓表多帶一個「引數槽名」。
 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('pow', {
    conceptId: 'cpp:math_pow',
    argSlots: ['base', 'exponent'],
    source: 'cpp/math_pow',
  })
}
