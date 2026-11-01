/** `cpp:loop_range` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_range', (n, f) => {
    const vt = String(n.properties?.var_type ?? '')
    const targets = n.slots?.targets ?? []
    // 結構化繫結的範圍 for（`for (auto [k, v] : m)`）：sForBind（cella 2026-11-01 給的形狀）；名字的宣告 id 是 targets 那幾顆節點
    if (targets.length > 0) {
      const t = f.type(vt || 'auto', n)
      if (!t) return [f.k('sHole', { n: n.id })]
      const names = targets.map((x) => f.k('binder', { x: x.id, name: String(x.properties?.name ?? '') }))
      return [f.k('sForBind', { n: n.id, names, t, range: f.exprOf(n, 'iterable'), body: f.block(n, 'body') })]
    }
    const byRef = vt.endsWith('&')
    const t = f.type(byRef ? vt.slice(0, -1).trim() : vt, n)
    if (!t) return [f.k('sHole', { n: n.id })]
    return [f.k('sForRange', { n: n.id, x: n.id, name: String(n.properties?.var_name ?? ''), t, byRef, range: f.exprOf(n, 'iterable'), body: f.block(n, 'body') })]
  })
  // 作用域：range 在外層求值；迴圈變數住在迴圈那一層，本體再開一層
  r.scope('cpp:loop_range', (n, w) => {
    w.walkSlot(n, 'iterable')
    w.inScope(() => {
      const targets = n.slots?.targets ?? []
      if (targets.length > 0) for (const x of targets) w.declare(String(x.properties?.name ?? ''), x.id)
      else w.declare(String(n.properties?.var_name ?? ''), n.id)
      w.inScope(() => w.walkSlot(n, 'body'))
    })
  })
}
