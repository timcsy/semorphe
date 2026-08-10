/**
 * `cpp:math_unary` 的 **lift** 路——**一顆身分涵蓋 18 個函式名**
 *
 * `sqrt(x)`、`sin(x)`、`log(x)`… 共用一顆概念，靠 `func` 屬性區分。
 * 那是「[[概念代數]] 的種差」：操作是同一個（一元數學函式），
 * 種差是哪一個。
 *
 * ⚠️ **`abs` 不在這張表裡**——它是 `<cstdlib>` 的整數版，
 * 而執行器的 switch 仍認得 `'abs'`（見 `execute.ts` 的註解）。
 * 這一路只登錄 `<cmath>` 真正提供的那些。
 *
 * 形狀的來歷見 `../math_pow/lift.ts`：`tryCmathLift` 拆開只剩三列資料。
 */
import { registerCallConcept } from '../../../core/component/call-concepts'

/** ⚠️ 這張名單就是「哪些寫法會被辨識」——少一個名字＝那個函式掉進 raw_code。 */
const 一元函式 = [
  'fabs', 'sqrt', 'cbrt',
  'ceil', 'floor', 'round', 'trunc',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'exp', 'log', 'log2', 'log10',
]

export function registerLift(): void {
  registerCallConcept(一元函式, {
    conceptId: 'cpp:math_unary',
    argSlots: ['value'],
    funcProp: 'func',
    來源: 'cpp/math_unary',
  })
}
