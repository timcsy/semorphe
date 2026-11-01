/** `cpp:loop_for` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_for', (n, f) => {
    const init = (n.slots?.init ?? []).flatMap((c) => f.stmt(c))
    const c = f.one(n, 'cond'), st = f.one(n, 'update')
    const loop = (i: unknown) => f.k('sFor', { n: n.id, init: i ?? null, c: c ? f.expr(c) : null, step: st ? f.expr(st) : null, body: f.block(n, 'body') })
    // `for (int l = i, r = n - 1; …)`：Cella 的 sFor 只收一個 init ⟹ 外包一層區塊、宣告放在前面、init 留空。
    // 名字的作用域一樣只到迴圈結束（[stmt.for]p1 本來就是這樣定義的），continue 也照樣走到 step（第 213 刀，學生的程式 2 支）
    if (init.length > 1) return [f.k('sBlock', { n: `${n.id}/init`, body: [...init, loop(null)] })]
    return [loop(init[0])]
  })
  // 作用域：init、cond、update 住在迴圈那一層；本體再開一層
  r.scope('cpp:loop_for', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'init')
    w.walkSlot(n, 'cond')
    w.walkSlot(n, 'update')
    w.inScope(() => w.walkSlot(n, 'body'))
  }))
}
