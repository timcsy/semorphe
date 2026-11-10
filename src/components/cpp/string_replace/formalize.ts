/**
 * `cpp:string_replace` 的 **formalize** 路（398）——`s.replace(pos, len, t)`，照 generate 送 eMCall。
 * ⚠️ generate 在接點空著時補 `0`／`""`；這裡不補——空的接點照引擎的規矩送洞（P6，不猜）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_replace', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'replace', args: [f.exprOf(n, 'pos'), f.exprOf(n, 'len'), f.exprOf(n, 'value')] }))
  r.stmt('cpp:string_replace', (n, f) => f.exprStmt(n))
}
