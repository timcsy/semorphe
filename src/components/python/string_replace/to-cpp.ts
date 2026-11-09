/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { cppString } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

/** 分隔字串是空的在 Python 會丟例外（replace 則是到處插入）——只收非空的字面量 */
const litOk = (x: SemanticNode | undefined): boolean => !!x && x.componentId.endsWith(':literal_string') && String(x.properties?.value ?? '') !== ''

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const old = n.slots.old?.[0]
    if (!litOk(old)) return cpp.keep(n, 'outside-subset', 'replace 要換掉的不是非空的字串字面量')
    const to = n.slots.new?.[0]
    const toText = to?.componentId.endsWith(':literal_string') ? cppString(String(to.properties?.value ?? '')) : `${cpp.expr(to)}.c_str()`
    return `${cpp.useHelper('replace_all')}(${cpp.expr(n.slots.obj?.[0])}, ${cppString(String(old!.properties.value))}, ${toText})`
  })
}
