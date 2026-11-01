/** `cpp:operator_overload` 的 **formalize** 路（spec 201：學生的程式 12 支在 struct 裡寫 `bool operator<`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 類別成員：mbMethod ＋ fdef（cella 2026-11-01 給的形狀，同 cpp_to_tree.py）；參數的宣告 id 是 `<id>/param`（它在語義樹裡是屬性，不是節點）
  r.member('cpp:operator_overload', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const name = String(p.param_name ?? '')
    const params = String(p.param_type ?? '').trim() === '' ? [] : [f.k('param', { x: `${n.id}/param`, name, t: f.type(p.param_type, n), dflt: null })]
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: `operator${String(p.operator ?? '+')}`, ret, params, body: f.block(n, 'body') })
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k('vNone'), f: fdef })
  })
  // 作用域：參數與本體同一層——參數名指到 `<id>/param`
  r.scope('cpp:operator_overload', (n, w) => w.inScope(() => {
    const name = String(n.properties?.param_name ?? '')
    if (name) w.declare(name, `${n.id}/param`)
    w.walkSlot(n, 'body')
  }))
}
