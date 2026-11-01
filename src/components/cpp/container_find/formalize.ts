/** `cpp:container_find` 的 **formalize** 路（spec 199：6.0 量到學生的程式 7 支用 find／lower_bound）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `how` 是方法名（find、lower_bound、upper_bound…）——照原樣送
  r.expr('cpp:container_find', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: String(n.properties?.how ?? 'find'), args: f.one(n, 'key') ? [f.exprOf(n, 'key')] : [] }))
}
