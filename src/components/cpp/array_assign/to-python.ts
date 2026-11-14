/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue, isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const value = n.slots.value?.[0]
    // `s[0] = 'z'` 也是這一顆：元素是 char ⟹ 那是在改字串裡的字元，Python 的字串不能改——保留（反例抓到的）
    if (isChar(py.typeOf(n)) || isChar(py.typeOf(value))) return [py.keep(n, 'char', '改字串裡的一個字元：C++ 的字串可以改、Python 的字串不能')]
    const o = py.name(String(n.properties.obj ?? ''))
    // 浮點放進整數陣列：C++ 隱含截斷——元素型別先問 Cella，沒給就問宣告那一顆記下的（459：原本只問 Cella，而 Cella 不給這一句型別 ⟹ 7.9 原樣放進去）
    const et = py.typeOf(n) ?? py.elementTypeOf(o)
    if (et === undefined && /^(const\s+)?(double|float|long double)/.test(py.typeOf(value) ?? '')) return [py.keep(n, 'needs-types', `放進 ${o} 的值是浮點，而不知道 ${o} 的元素型別`)]
    const target = `${o}[${py.expr(n.slots.index?.[0])}]`
    return [`${py.indent(depth)}${target} = ${intValue(et, py.typeOf(value), py.expr(value))}`]
  })
}
