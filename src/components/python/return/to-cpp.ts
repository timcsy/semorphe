/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => [(n.slots.value ?? []).length > 0 ? `${cpp.indent(depth)}return ${cpp.expr(n.slots.value?.[0])};` : `${cpp.indent(depth)}return;`])
}
