/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const init = n.slots.initializer?.[0]
    py.noteDeclaredString(String(n.properties.name ?? '')) // 讓後面的 `cin >> s` 知道要讀成字串（C++ 先宣告才用，走到這裡時已記下）
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${init ? py.expr(init) : '""'}`]
  })
}
