/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { cppString } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

/** 分隔字串是空的在 Python 會丟例外（replace 則是到處插入）——只收非空的字面量 */
const litOk = (x: SemanticNode | undefined): boolean => !!x && x.componentId.endsWith(':literal_string') && String(x.properties?.value ?? '') !== ''

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const sep = n.slots.value?.[0]
    if (!sep) return `${cpp.useHelper('split_words')}(${cpp.expr(n.slots.obj?.[0])})`
    if (!litOk(sep)) return cpp.keep(n, 'outside-subset', 'split 的分隔不是非空的字串字面量')
    return `${cpp.useHelper('split_on')}(${cpp.expr(n.slots.obj?.[0])}, ${cppString(String(sep!.properties.value))})`
  })
}
