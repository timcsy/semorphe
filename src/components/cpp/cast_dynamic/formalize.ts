/** `cpp:cast_dynamic` 的 **formalize** 路（399）——`dynamic_cast<T>(e)` 送 `eDynCast{t, a}`（形狀見 cast_const/formalize.ts 的檔頭，cella 2026-11-03 給的）。型別認不得 → 回洞（不猜）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast_dynamic', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    return f.k('eDynCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
