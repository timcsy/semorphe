/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const v = String(n.properties.value ?? '')
    // Python 的整數沒有上限；超過 long long 的字面量照實保留
    if (/^\d+$/.test(v) && v.length > 18) return cpp.keep(n, 'overflow', `整數 ${v} 超過 C++ long long 的範圍`)
    if (!/^(\d+|\d+\.\d*|\d*\.\d+)$/.test(v)) return cpp.keep(n, 'outside-subset', `數字寫法 ${v} 還沒有對應`)
    return /^\d+$/.test(v) && v.length > 9 ? `${v}LL` : v
  })
}
