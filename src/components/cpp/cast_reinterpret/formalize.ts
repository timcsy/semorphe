/** `cpp:cast_reinterpret` 的 **formalize** 路（399）——`reinterpret_cast<T>(e)` 送 `eReinterpretCast{t, a}`（形狀見 cast_const/formalize.ts 的檔頭，cella 2026-11-03 給的）。型別認不得 → 回洞（不猜）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast_reinterpret', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    return f.k('eReinterpretCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
