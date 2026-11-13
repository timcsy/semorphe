/**
 * `cpp:math_constrain` 的 **formalize** 路——Arduino 核心的 `constrain(x, lo, hi)`，在 Cella 是一般的函式呼叫（433；`@cella-lang/arduino` 的核心有它）。
 * ⚠️ 只在板子上送：`constrain` 是 Arduino 的巨集，標準 C++ 沒有它——沒有板子時送出去會是假的 reject「呼叫未宣告的函式」，所以照實回翻不出（P6）。
 * 契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_constrain', (n, f) =>
    f.options.board
      ? f.call(n, 'constrain', ['value', 'low', 'high'])
      : f.miss(n, 'constrain 是 Arduino 的巨集，不在板子上時標準 C++ 沒有它'))
}
