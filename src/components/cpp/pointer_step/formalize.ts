/** `cpp:pointer_step` 的 **formalize** 路（spec 199：6.0 量到學生的程式 10 支用 next／prev）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:pointer_step', (n, f) => f.k('eCall', { n: n.id, f: String(n.properties?.direction ?? 'next'), args: ['pos', 'count'].filter((sl) => f.one(n, sl)).map((sl) => f.exprOf(n, sl)) }))
}
