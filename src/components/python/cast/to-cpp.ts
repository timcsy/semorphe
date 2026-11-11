/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const to = String(n.properties.target_type ?? '')
    const v = n.slots.value?.[0]
    const from = cpp.pyType(v)
    if (to === 'int') {
      // stoi（Cella 認得；stoll 還沒有）——32 位元以內；更大的值由換完之後那一次 C++ 判決抓（research R3）
      // 在抓 ValueError 的 try 裡：stoi 吃得下 "12abc"，Python 會丟 ValueError——換成照 Python 規則的 py_int
      if (from === 'str' && cpp.catchingValueError()) return `${cpp.useHelper('py_int')}(${cpp.expr(v)})`
      if (from === 'str') return `stoi(${cpp.expr(v)})`
      // int(浮點)：Python 與 C++ 都向零截斷
      if (from === 'float' || from === 'int' || from === 'bool') return `(long long)(${cpp.expr(v)})`
    }
    if (to === 'float') {
      if (from === 'str') return `stod(${cpp.expr(v)})`
      if (from === 'int' || from === 'float') return `(double)(${cpp.expr(v)})`
    }
    if (to === 'str' && (from === 'int')) return `to_string(${cpp.expr(v)})`
    // str(浮點)：與 print 同一個 repr（to_string 印 6 位小數，404）
    if (to === 'str' && from === 'float') return `${cpp.useHelper('float_text')}(${cpp.expr(v)})`
    if (to === 'str' && from === 'str') return cpp.expr(v)
    return cpp.keep(n, 'type-uncertain', `${to}(…) 的對象型別（${from ?? '?'}）`)
  })
}
