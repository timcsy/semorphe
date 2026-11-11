/** 這顆元件寫成 C++（405）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // d.get(k, 預設)：(d.count(k) ? d.find(k)->second : 預設)。字典與鍵各寫兩次——只收變數與字面量（沒有副作用、兩次的值相同）
  r.expr((n, cpp) => {
    const obj = n.slots.obj?.[0], key = n.slots.key?.[0], dflt = n.slots.fallback?.[0]
    const plain = (x: typeof obj) => !!x && /:(var_ref|literal_number|literal_string|literal_bool)$/.test(x.componentId)
    if (!dflt) return cpp.keep(n, 'outside-subset', 'get 沒有預設值（缺鍵時是 None）')
    if (!obj?.componentId.endsWith(':var_ref') || !plain(key)) return cpp.keep(n, 'outside-subset', 'get 的字典或鍵不是變數或字面量')
    const t = cpp.pyType(obj), vt = /^dict\[.+, (.+)\]$/.exec(t ?? '')?.[1]
    // 預設值與字典的值型別不同時，Python 的結果型別要看鍵在不在——C++ 的三元運算子只有一個型別
    if (!vt || cpp.pyType(dflt) !== vt || cpp.pyType(n) !== vt) return cpp.keep(n, 'type-uncertain', `get 的預設值與字典的值型別（${t ?? '?'}）`)
    const o = cpp.expr(obj), k = cpp.expr(key)
    return `(${o}.count(${k}) ? ${o}.find(${k})->second : ${cpp.expr(dflt)})`
  })
}
