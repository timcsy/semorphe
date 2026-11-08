/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.yieldsBool()
  r.expr((n, py) => {
    const op = String(n.properties.operator ?? '')
    const l = n.slots.left?.[0], rr = n.slots.right?.[0]
    // `a % b == 0`／`!= 0`：正負號不影響「是不是 0」⟹ 取餘數在這裡可以換（research R4）
    if ((op === '==' || op === '!=') && rr?.properties?.value === '0' && l?.properties?.operator === '%' && l.slots?.left && l.slots?.right) {
      return `${paren(l.slots.left[0], py)} % ${paren(l.slots.right[0], py)} ${op} 0`
    }
    // char 對 char：Python 單一字元的字串比較就是比字碼 ⟹ 直接比；char 對整數 ⟹ char 那一邊取 ord（364）
    const lc = isChar(py.typeOf(l)), rc = isChar(py.typeOf(rr))
    if (lc !== rc) return `${lc ? `ord(${py.expr(l)})` : paren(l, py)} ${op} ${rc ? `ord(${py.expr(rr)})` : paren(rr, py)}`
    return `${paren(l, py)} ${op} ${paren(rr, py)}`
  })
}
