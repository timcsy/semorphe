/** `cpp:func_def` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:func_def', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? '') === 'void' ? null : f.type(p.return_type, n)
    // `f(void)`＝沒有參數（C11 6.7.6.3p10）——不是一個型別是 void 的參數（spec 197：`int main(void)` 整支卡在「型別 void 還沒有對應」）
    const raw = n.slots?.params ?? []
    const onlyVoid = raw.length === 1 && String(raw[0].properties?.type ?? '').trim() === 'void' && String(raw[0].properties?.name ?? '').trim() === ''
    const params = (onlyVoid ? [] : raw).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null }))
    return [f.k('iFun', { f: f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') }) })]
  })
  // 作用域：參數與本體同一層
  r.scope('cpp:func_def', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
