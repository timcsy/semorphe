/**
 * `cpp:cast_static` 的 **formalize** 路（spec 202）。契約見 `core/formalize-contract.ts`。
 *
 * 純量之間的 `static_cast<T>(e)` 與 C 風格的 `(T)e` 是同一個轉換（[expr.static.cast]p4、[expr.cast]p4：
 * C 風格轉型先試 static_cast）⟹ 同 `cpp:cast` 送 `eCast`。型別認不得 → 引擎記 unknown、回洞（不猜）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast_static', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    return f.k('eCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
