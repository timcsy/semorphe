/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 讀一個字元（`s[i]`）：Python 拿到的是長度 1 的字串——拿來比較、印出都一樣；拿來算（`s[i] - 'a'`）在 arithmetic 那顆保留
  r.expr((n, py) => `${String(n.properties.obj ?? '')}[${py.expr(n.slots.index?.[0])}]`)
}
