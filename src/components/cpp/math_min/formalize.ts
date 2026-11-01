/** `cpp:math_min` 的 **formalize** 路（spec 199：6.0 量到學生的程式 15 支用 min）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `min({a, b, c})` 只填了 a：送一個引數（同 generate.ts 的「不得補第二個」）——第 213 刀前空著的 b 被送成 eHole，
  // Cella 於是判 unknown「a braced list where the type it initializes is not known」（cella 照同一支程式重現時發現）
  r.expr('cpp:math_min', (n, f) => f.k('eCall', { n: n.id, f: 'min', args: f.one(n, 'a') && !f.one(n, 'b') ? [f.exprOf(n, 'a')] : [f.exprOf(n, 'a'), f.exprOf(n, 'b')] }))
}
