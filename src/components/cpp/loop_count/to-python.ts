/** `cpp:loop_count` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `for (int i = a; i < b; i++)` → for i in range(a, b)；`<=` → range(a, b + 1)
  r.stmt('cpp:loop_count', (n, py, depth) => {
    const v = String(n.properties.var_name ?? 'i')
    // 本體改了迴圈變數：C++ 的下一圈看得到、Python 的 range 看不到——第一版不換（問形狀：有 target 槽、指到同名變數）
    const writes = (x: import('../../../core/types').SemanticNode): boolean =>
      (x.slots?.target?.[0]?.properties?.name === v) || Object.values(x.slots ?? {}).some((kids) => kids.some(writes))
    if ((n.slots.body ?? []).some(writes)) return [py.keep(n, 'outside-subset', `迴圈本體改了迴圈變數 ${v}（range 不會跟著變）`)]
    const from = n.slots.from?.[0], to = n.slots.to?.[0]
    const inclusive = String(n.properties.inclusive ?? '').toUpperCase() === 'TRUE'
    const end = inclusive ? `${paren(to, py)} + 1` : py.expr(to)
    const head = from?.properties?.value === '0' && !from.slots?.left ? `range(${end})` : `range(${py.expr(from)}, ${end})`
    return [`${py.indent(depth)}for ${v} in ${head}:`, ...py.block(n.slots.body, depth + 1)]
  })
}
