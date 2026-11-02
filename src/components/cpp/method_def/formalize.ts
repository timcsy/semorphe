/** `cpp:method_def` 的 **formalize** 路（第 218 刀）——類別成員 mbMethod ＋ fdef（形狀同運算子多載那顆，cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:method_def', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null }))
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') })
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k('vNone'), f: fdef })
  })
  // 作用域：參數與本體同一層（同頂層函式那顆）
  r.scope('cpp:method_def', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
