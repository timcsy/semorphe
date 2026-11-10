/** `cpp:template_function` 的 **formalize** 路（397）——函式樣板：`iTemplate { n, tparams, f }`，型別位置的參數是 `tParam`（形狀同 Cella 的參照翻譯 cpp_to_tree.py）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.definesFunction('cpp:template_function', (n) => String(n.properties?.func_name ?? ''))
  r.item('cpp:template_function', (n, f) => {
    const p = n.properties ?? {}
    const t = String(p.t ?? 'T')
    return f.withTypeParams([t], () => {
      const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
      const params = (n.slots?.params ?? []).map((q) =>
        f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: f.defaultArgument(q) }))
      const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.func_name ?? ''), ret, params, body: f.block(n, 'body') })
      return [f.k('iTemplate', { n: n.id + '/t', tparams: [f.k('tpType', { name: t, dflt: null })], f: fdef })]
    })
  })
  // 作用域：參數與本體同一層（同一般函式那顆）
  r.scope('cpp:template_function', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
