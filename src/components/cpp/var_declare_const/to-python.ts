/**
 * 這顆元件寫成 Python（453）：`const int MAXN = 5;` → `MAXN = 5`（Python 沒有常數；C++ 那側不准改它，所以兩邊讀到的值一樣）。
 * 只收整數／浮點／bool 的一般初值；char、字串、容器、建構子形式照實保留。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue } from '../../../languages/cpp/to-python/contract'

const ARITH = /^(?:(?:unsigned|signed)\s+)?(?:long long|long double|long|int|short|double|float|bool)(?:\s+int)?$/

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const type = String(n.properties.type ?? '').trim()
    const init = n.slots.initializer ?? []
    if (!ARITH.test(type) || n.properties.init_style === 'constructor' || init.length !== 1) {
      return [py.keep(n, 'outside-subset', `常數「${type} ${String(n.properties.name ?? '')}」的宣告還沒有對應`)]
    }
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${intValue(type, py.typeOf(init[0]), py.expr(init[0]))}`]
  })
}
