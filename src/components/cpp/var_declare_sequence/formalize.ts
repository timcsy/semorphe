/** `cpp:var_declare_sequence` 的 **formalize** 路（學生的程式 16 支用結構化繫結 `auto [a, b] = p;`；形狀是 cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // sBind：名字的宣告 id 是 targets 那幾顆節點；`auto&` → tRef(tAuto)
  r.stmt('cpp:var_declare_sequence', (n, f) => {
    const names = (n.slots?.targets ?? []).map((x) => f.k('binder', { x: x.id, name: String(x.properties?.name ?? '') }))
    const t = String(n.properties?.binding ?? 'value') === 'reference' ? f.k('tRef', { t: f.k('tAuto') }) : f.k('tAuto')
    return [f.k('sBind', { n: n.id, names, t, init: f.exprOf(n, 'value') })]
  })
  // 作用域：右邊先求值，再宣告每一個名字
  r.scope('cpp:var_declare_sequence', (n, w) => {
    w.walkSlot(n, 'value')
    for (const x of n.slots?.targets ?? []) w.declare(String(x.properties?.name ?? ''), x.id)
  })
}
