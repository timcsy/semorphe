/** `cpp:var_declare` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt('cpp:var_declare', (n, py, depth) => {
    // 一行好幾個（`int a = 7, b = 3;`）：宣告子各自是一顆 var_declare
    if (n.slots.declarators?.length) return n.slots.declarators.flatMap((d) => py.block([d], depth))
    const type = String(n.properties.type ?? '')
    const name = String(n.properties.name ?? '')
    const init = n.slots.initializer?.[0]
    if (type === 'char') return [py.keep(n, 'char', 'char 變數：C++ 的 char 是整數，Python 沒有對應的型別')]
    if (init) return [`${py.indent(depth)}${name} = ${py.expr(init)}`]
    // 沒有初值：照型別給一個起始值（讀到沒初始化的值在 C++ 是未定義行為，Cella 會先判出來）
    const zero = /^(int|long|long long|short|unsigned.*)$/.test(type) ? '0' : type === 'double' || type === 'float' ? '0.0' : type === 'bool' ? 'False' : null
    if (zero === null) return [py.keep(n, 'outside-subset', `型別「${type}」的宣告還沒有對應`)]
    return [`${py.indent(depth)}${name} = ${zero}`]
  })
}
