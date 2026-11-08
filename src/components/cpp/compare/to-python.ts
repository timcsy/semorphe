/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.yieldsBool()
  r.expr((n, py) => {
    const op = String(n.properties.operator ?? '')
    const l = n.slots.left?.[0], rr = n.slots.right?.[0]
    // `a % b == 0`／`!= 0`：正負號不影響「是不是 0」⟹ 取餘數在這裡可以換（research R4）
    if ((op === '==' || op === '!=') && rr?.properties?.value === '0' && l?.properties?.operator === '%' && l.slots?.left && l.slots?.right) {
      return `${paren(l.slots.left[0], py)} % ${paren(l.slots.right[0], py)} ${op} 0`
    }
    return `${paren(l, py)} ${op} ${paren(rr, py)}`
  })
}
