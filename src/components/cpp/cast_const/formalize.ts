/**
 * `cpp:cast_const` 的 **formalize** 路（第 238 刀）——`const_cast<T>(e)` 送 `eConstCast{t, a}`（cella 2026-11-03 給的專用形狀；
 * static_cast 是 eCast、reinterpret_cast 是 eReinterpretCast、dynamic_cast 是 eDynCast）。契約見 `core/formalize-contract.ts`。
 * ⚠️ 透過它去**寫**一個本來就宣告成 const 的物件是未定義行為（[dcl.type.cv]p4）——那由 Cella 判 reject，我們照送。型別認不得 → 回洞（不猜）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cast_const', (n, f) => {
    const t = f.type(n.properties?.target_type ?? 'int', n)
    if (!t) return f.k('eHole', { n: n.id })
    return f.k('eConstCast', { n: n.id, t, a: f.exprOf(n, 'value') })
  })
}
