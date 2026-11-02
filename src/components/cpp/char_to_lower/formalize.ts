/** `cpp:char_to_lower` 的 **formalize** 路（spec 203）——`tolower(c)` → `eCall "tolower"`（<cctype>）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:char_to_lower', (n, f) => f.k('eCall', { n: n.id, f: 'tolower', args: [f.exprOf(n, 'value')] }))
  r.stmt('cpp:char_to_lower', (n, f) => f.exprStmt(n))
}
