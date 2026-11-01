/** `cpp:bits_fill` 的 **formalize** 路（第 213 刀）——`b.set()`／`b.reset(i)`／`b.flip()` → `eMCall`，方法名照使用者寫的。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:bits_fill', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: String(n.properties?.method ?? 'reset'), args: f.one(n, 'pos') ? [f.exprOf(n, 'pos')] : [] }))
  r.stmt('cpp:bits_fill', (n, f) => f.exprStmt(n))
}
