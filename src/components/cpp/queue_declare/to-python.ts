/** 這顆元件寫成 Python（448）：queue → collections.deque（前端出的時候是 O(1)；list.pop(0) 意思也對但是 O(n)）。
 * 475：Cella 0249 起判得出 `collections`，拿掉「等 Cella」的保留。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = String(n.properties.type ?? '')
    if (adapterKind(`queue<${t}>`) !== 'queue') return [py.keep(n, 'outside-subset', `queue<${t}> 還沒有對應`)]
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${py.useImport('collections')}.deque()`]
  })
}
