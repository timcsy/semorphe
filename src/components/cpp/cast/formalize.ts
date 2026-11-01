/** `cpp:cast` 的 **formalize** 路（spec 199：6.0 量到學生的程式 12 支用 (型別) 轉型）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    // `T()`：純量的值初始化就是零（[dcl.init.general]p9 → zero-initialize）⟹ `(T)0`（第 213 刀）；類別的 `T()` 要呼叫建構子，還沒有對應
    if (!f.one(n, 'value')) {
      return f.scalar(String(n.properties?.target_type ?? 'int').trim()) !== undefined
        ? f.k('eCast', { n: n.id, t, a: f.k('eNum', { n: `${n.id}/zero`, v: 0 }) })
        : f.miss(n, '類別的 `T()`（值初始化）還沒有對應')
    }
    return f.k('eCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
