/** 這顆元件寫成 Python（450）：`m[k] = v`（dict 的指定本來就會補上沒有的鍵） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const v = n.slots.value?.[0]
    const o = py.name(String(n.properties.obj ?? ''))
    // 浮點放進整數的 map：C++ 隱含截斷（同 var_assign）——值型別問宣告那一顆記下的（Cella 不給這一句型別）；不知道而值是浮點 ⟹ 保留
    const vt = py.elementTypeOf(o)
    if (vt === undefined && /^(const\s+)?(double|float|long double)/.test(py.typeOf(v) ?? '')) return [py.keep(n, 'needs-types', `放進 ${o} 的值是浮點，而不知道 ${o} 的值型別`)]
    return [`${py.indent(depth)}${o}[${py.expr(n.slots.key?.[0])}] = ${intValue(vt, py.typeOf(v), py.expr(v))}`]
  })
}
