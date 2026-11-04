/** `cpp:string_as_cstring` 的 **formalize** 路（spec 215：換成 printf 時 `%s` 的引數是 `s.c_str()`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_as_cstring', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'c_str', args: [] }))
}
