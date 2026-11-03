/**
 * `cpp:method_override` 的 **formalize** 路（spec 208）——類別成員 mbMethod ＋ fdef，virt 送 `vOverride`（形狀 cella 2026-11-03 給的：Virtuality = vNone | vVirtual | vOverride | vPure）。
 * 尾端 const 由 `is_const` 照實送（spec 209）。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:method_override', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null }))
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') })
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k('vOverride'), f: fdef })
  })
  r.scope('cpp:method_override', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
