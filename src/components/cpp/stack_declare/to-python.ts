/** 這顆元件寫成 Python（448）：stack → list，尾端進出 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = String(n.properties.type ?? '')
    if (adapterKind(`stack<${t}>`) !== 'stack') return [py.keep(n, 'outside-subset', `stack<${t}> 還沒有對應`)]
    return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = []`]
  })
}
