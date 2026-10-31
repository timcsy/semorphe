/** `cpp:loop_for` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_for', (n, f) => {
    const init = (n.slots?.init ?? []).flatMap((c) => f.stmt(c))
    if (init.length > 1) { f.miss(n, 'for 的 init 有多個宣告還沒有對應'); return [f.k('sHole', { n: n.id })] }
    const c = f.one(n, 'cond'), st = f.one(n, 'update')
    return [f.k('sFor', { n: n.id, init: init[0] ?? null, c: c ? f.expr(c) : null, step: st ? f.expr(st) : null, body: f.block(n, 'body') })]
  })
  // 作用域：init、cond、update 住在迴圈那一層；本體再開一層
  r.scope('cpp:loop_for', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'init')
    w.walkSlot(n, 'cond')
    w.walkSlot(n, 'update')
    w.inScope(() => w.walkSlot(n, 'body'))
  }))
}
