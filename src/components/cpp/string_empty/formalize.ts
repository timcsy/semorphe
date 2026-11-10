/** `cpp:string_empty` 的 **formalize** 路（398）——`s.empty()`，照 generate 送 eMCall（這顆只從積木來，見 component.json 的 _lift_why）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_empty', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'empty', args: [] }))
}
