/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue, isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const value = n.slots.value?.[0]
    // `s[0] = 'z'` 也是這一顆：元素是 char ⟹ 那是在改字串裡的字元，Python 的字串不能改——保留（反例抓到的）
    if (isChar(py.typeOf(n)) || isChar(py.typeOf(value))) return [py.keep(n, 'char', '改字串裡的一個字元：C++ 的字串可以改、Python 的字串不能')]
    const target = `${py.name(String(n.properties.obj ?? ''))}[${py.expr(n.slots.index?.[0])}]`
    return [`${py.indent(depth)}${target} = ${intValue(py.typeOf(n), py.typeOf(value), py.expr(value))}`]
  })
}
