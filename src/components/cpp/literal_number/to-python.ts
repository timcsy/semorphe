/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `100LL`、`1.5f`：去掉後綴（Python 的整數沒有上限、浮點就是 double）
  r.expr((n) => String(n.properties.value ?? '0').replace(/(?<=\d)[uUlL]+$/, '').replace(/(?<=\d\.?\d*)[fF]$/, ''))
}
