/** `cpp:cast` 的 **formalize** 路（spec 199：6.0 量到學生的程式 12 支用 (型別) 轉型）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    if (!f.one(n, 'value')) return f.miss(n, '`T()`（值初始化）還沒有對應')
    return f.k('eCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
