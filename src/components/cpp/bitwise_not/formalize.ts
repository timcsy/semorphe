/** `cpp:bitwise_not` 的 **formalize** 路（第 207 刀：學生的程式 4 支用 `~x`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:bitwise_not', (n, f) => f.k('eUn', { n: n.id, op: f.k('opBitNot'), a: f.exprOf(n, 'operand') }))
}
