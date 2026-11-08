/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const out = [`${py.indent(depth)}if ${py.expr(n.slots.condition?.[0])}:`, ...py.block(n.slots.then_body, depth + 1)]
    let els = n.slots.else_body ?? []
    // else if 鏈 → elif（問形狀：else 本體只有一顆、而它有 condition 與 then_body）
    while (els.length === 1 && els[0].slots?.condition && els[0].slots?.then_body) {
      out.push(`${py.indent(depth)}elif ${py.expr(els[0].slots.condition[0])}:`, ...py.block(els[0].slots.then_body, depth + 1))
      els = els[0].slots.else_body ?? []
    }
    if (els.length > 0) out.push(`${py.indent(depth)}else:`, ...py.block(els, depth + 1))
    return out
  })
}
