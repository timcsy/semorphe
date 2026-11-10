/**
 * `cpp:exception_make` 的 **formalize** 路（399）——`runtime_error("…")` 是建一個標準例外的暫時物件：送 eTemp，型別是 tStdExc
 * （引擎的 type() 認得標準例外；同 cpp_to_tree.py）。訊息空著是洞（generate 補 `""`，這裡不補）；型別認不得照實翻不出。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:exception_make', (n, f) => {
    const kind = String(n.properties?.kind ?? 'runtime_error')
    const t = f.type(kind, n)
    if (!t) return f.miss(n, `「${kind}(…)」這個例外型別還沒有對應`)
    return f.k('eTemp', { n: n.id, t, args: [f.exprOf(n, 'message')] })
  })
}
