/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar, intValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    // 一行好幾個（`int a = 7, b = 3;`）：宣告子各自是一顆 var_declare
    if (n.slots.declarators?.length) return n.slots.declarators.flatMap((d) => py.block([d], depth))
    const type = String(n.properties.type ?? '')
    const name = py.name(String(n.properties.name ?? ''))
    let init = n.slots.initializer?.[0]
    // 大括號初始化（`int x{}`、`int x{5}`，453：StudyCpp 13 支只差這一項）——問形狀：沒有屬性、只有 values 槽的初值。
    // 空的是值初始化（0），一個元素就是那個值（大括號不准窄化，值不變）；多個元素不是純量的初值，保留
    const braces = init && init.slots?.values !== undefined && Object.keys(init.properties ?? {}).length === 0 ? init.slots.values : undefined
    if (braces && braces.length > 1) return [py.keep(n, 'outside-subset', `「${type} ${String(n.properties.name ?? '')}」的大括號初值有 ${braces.length} 個`)]
    if (braces) init = braces[0]
    // char 變數：Python 用長度 1 的字串；初值是整數 ⟹ chr()（364）
    if (type === 'char') {
      if (!init) return [`${py.indent(depth)}${name} = chr(0)`]
      return [`${py.indent(depth)}${name} = ${isChar(py.typeOf(init)) || init.properties?.char !== undefined ? py.expr(init) : `chr(${py.expr(init)})`}`]
    }
    if (init) return [`${py.indent(depth)}${name} = ${intValue(type, py.typeOf(init), py.expr(init))}`]
    // 沒有初值：照型別給一個起始值（讀到沒初始化的值在 C++ 是未定義行為，Cella 會先判出來）
    const zero = /^(int|long|long long|short|unsigned.*)$/.test(type) ? '0' : type === 'double' || type === 'float' ? '0.0' : type === 'bool' ? 'False' : null
    if (zero === null) return [py.keep(n, 'outside-subset', `型別「${type}」的宣告還沒有對應`)]
    return [`${py.indent(depth)}${name} = ${zero}`]
  })
}
