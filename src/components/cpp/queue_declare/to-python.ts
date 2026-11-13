/** 這顆元件寫成 Python（448）：queue → collections.deque（前端出的時候是 O(1)；list.pop(0) 意思也對但是 O(n)） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

const WAITING_FOR_CELLA = true

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = String(n.properties.type ?? '')
    if (adapterKind(`queue<${t}>`) !== 'queue') return [py.keep(n, 'outside-subset', `queue<${t}> 還沒有對應`)]
    // ⏳ Cella 的 Python 還不支援 `collections`（11-14 判 unknown「importing collections」，已請 cella 支援）——支援之前照實保留；
    //    發版後拿掉這一行，下面的寫法與 push／pop／front／top 那幾顆就接上了
    if (WAITING_FOR_CELLA) return [py.keep(n, 'outside-subset', 'Cella 的 Python 還不支援 collections.deque，換過去判不出來')]
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${py.useImport('collections')}.deque()`]
  })
}
