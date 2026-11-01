/** `cpp:container_erase` 的 **formalize** 路（spec 199：6.0 量到學生的程式 12 支用 erase）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:container_erase', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'erase', args: ['key', 'key_end'].filter((sl) => f.one(n, sl)).map((sl) => f.exprOf(n, sl)) }))
  r.stmt('cpp:container_erase', (n, f) => f.exprStmt(n))
}
