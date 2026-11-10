/**
 * `cpp:method_virtual_pure` 的 **formalize** 路（spec 208）——`virtual T f(...) = 0;`：mbMethod，virt 送 `vPure`，本體送空的 sBlock
 * （cella 2026-11-03：Cella 把它換成「呼叫純虛擬函式」的停止點；含純虛擬函式的類別是抽象的，不能建立物件）。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:method_virtual_pure', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null }))
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.k('sBlock', { n: n.id, body: [] }) })
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k('vPure'), f: fdef })
  })
  r.scope('cpp:method_virtual_pure', (n, w) => w.inScope(() => { w.walkSlot(n, 'params') }))
}
