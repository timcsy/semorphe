/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const k = n.slots.key?.[0]
    // 負的下標（xs[-1]）在 Python 從後面數、在 C++ 是越界
    if (k?.componentId.endsWith(':negate')) return cpp.keep(n, 'outside-subset', '負的下標（Python 從後面數）')
    const t = cpp.pyType(n.slots.target?.[0])
    // 讀字典（405）：缺鍵時 Python 拋 KeyError，C++ 的 [] 會默默插入一筆——經過 map_at（缺鍵丟例外）
    if (t && /^dict\[/.test(t)) {
      // 鍵與值的型別從字典來（d[k] op= v 的那一格沒有觀察到的型別）；鍵自己觀察到的型別要與字典的鍵相同
      const [, pk, pv] = /^dict\[(.+?), (.+)\]$/.exec(t) ?? []
      const mt = cpp.cppType(t), kt = cpp.cppType(pk), vt = cpp.cppType(pv)
      if (!mt || !kt || !vt || cpp.pyType(k) !== pk) return cpp.keep(n, 'type-uncertain', `讀字典的鍵或值型別（${t}）`)
      return `${cpp.useMapAt(mt, kt, vt)}(${cpp.expr(n.slots.target?.[0])}, ${cpp.expr(k)})`
    }
    if (!t || !/^list\[/.test(t)) return cpp.keep(n, 'type-uncertain', `下標的對象型別（${t ?? '?'}）`)
    return `${paren(n.slots.target?.[0], cpp)}[${cpp.expr(k)}]`
  })
}
