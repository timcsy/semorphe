/** `cpp:loop_range` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_range', (n, f) => {
    if ((n.slots?.targets ?? []).length > 0) { f.miss(n, '結構化繫結的 range-for 還沒有對應'); return [f.k('sHole', { n: n.id })] }
    const vt = String(n.properties?.var_type ?? '')
    const byRef = vt.endsWith('&')
    const t = f.type(byRef ? vt.slice(0, -1).trim() : vt, n)
    if (!t) return [f.k('sHole', { n: n.id })]
    return [f.k('sForRange', { n: n.id, x: n.id, name: String(n.properties?.var_name ?? ''), t, byRef, range: f.exprOf(n, 'iterable'), body: f.block(n, 'body') })]
  })
  // 作用域：range 在外層求值；迴圈變數住在迴圈那一層，本體再開一層
  r.scope('cpp:loop_range', (n, w) => {
    w.walkSlot(n, 'iterable')
    w.inScope(() => {
      w.declare(String(n.properties?.var_name ?? ''), n.id)
      w.inScope(() => w.walkSlot(n, 'body'))
    })
  })
}
