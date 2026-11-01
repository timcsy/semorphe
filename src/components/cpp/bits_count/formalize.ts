/** `cpp:bits_count` 的 **formalize** 路（第 213 刀）——`b.count()` → `eMCall … "count"`。`__builtin_popcount(x)` 是編譯器內建、Cella 還沒有，照實標 unknown。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:bits_count', (n, f) => {
    const method = String(n.properties?.method ?? '__builtin_popcount')
    if (method !== 'count') return f.miss(n, `「${method}」是編譯器內建函式，還沒有對應`)
    return f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'count', args: [] })
  })
}
