/** 這顆元件寫成 Python（448）：priority_queue → heapq 管理的 list（Python 的 heapq 是最小堆；最大堆存負數） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

const WAITING_FOR_CELLA = true

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = String(n.properties.type ?? '')
    if (!adapterKind(`priority_queue<${t}>`)) return [py.keep(n, 'outside-subset', `priority_queue<${t}> 還沒有對應（只收整數：最大堆存負數要精確）`)]
    // ⏳ Cella 的 Python 還不支援 `heapq`（11-14 判 unknown「importing heapq」，已請 cella 支援）——支援之前照實保留；
    //    發版後拿掉這一行，下面的寫法與 push／pop／front／top 那幾顆就接上了
    if (WAITING_FOR_CELLA) return [py.keep(n, 'outside-subset', 'Cella 的 Python 還不支援 heapq，換過去判不出來')]
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = []`]
  })
}
