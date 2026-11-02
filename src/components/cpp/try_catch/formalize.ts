/**
 * `cpp:try_catch` 的 **formalize** 路（spec 203）——`try { … } catch (T x) { … }` → `sTry n body [hCatch n t x name byRef body]`。
 * 形狀照 Cella 的 `cfamily.syntax`（`Handler`）。語義樹只有一個 catch（型別＋名字）；`catch (...)` 的型別是 none。
 * 例外變數的宣告 id 是 `<id>/catch`（它在語義樹裡是屬性，不是節點）。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:try_catch', (n, f) => {
    const raw = String(n.properties?.catch_type ?? '').trim()
    const all = raw === '...' || raw === ''
    const byRef = /&\s*$/.test(raw)
    const t = all ? null : f.type(raw.replace(/&\s*$/, '').trim(), n)
    const handler = f.k('hCatch', {
      n: `${n.id}/catch`, t, x: `${n.id}/catch`, name: all ? '' : String(n.properties?.catch_name ?? ''), byRef, body: f.block(n, 'catch_body'),
    })
    return [f.k('sTry', { n: n.id, body: f.block(n, 'try_body'), handlers: [handler] })]
  })
  // 作用域：try 的本體一層；catch 的本體一層，裡面看得到例外變數
  r.scope('cpp:try_catch', (n, w) => {
    w.inScope(() => w.walkSlot(n, 'try_body'))
    w.inScope(() => {
      const name = String(n.properties?.catch_name ?? '')
      if (name) w.declare(name, `${n.id}/catch`)
      w.walkSlot(n, 'catch_body')
    })
  })
}
