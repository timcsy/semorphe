/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { SemanticNode } from '../../../core/types'
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, mayWrite } from '../../../languages/cpp/to-python/contract'

/** 子樹裡出現的名字（變數、陣列／字串的 obj 屬性） */
const namesIn = (x: SemanticNode | undefined, acc = new Set<string>()): Set<string> => {
  if (!x) return acc
  for (const k of ['name', 'obj', 'var_name']) if (typeof x.properties?.[k] === 'string') acc.add(String(x.properties[k]))
  for (const kids of Object.values(x.slots ?? {})) kids.forEach((c) => namesIn(c, acc))
  return acc
}
/** 本體裡有屬於這一圈的 continue 嗎（不往內層迴圈的 body 走——那裡的 continue 屬於內層；if 的分支槽叫 then_body／else_body） */
const hasOwnContinue = (nodes: readonly SemanticNode[]): boolean => nodes.some((x) =>
  x.componentId.endsWith(':continue') || Object.entries(x.slots ?? {}).some(([k, kids]) => k !== 'body' && hasOwnContinue(kids)))

export function registerToPython(r: ToPythonRegistrar): void {
  // `for (int i = a; i < b; i++)` → for i in range(a, b)；`<=` → range(a, b + 1)
  r.stmt((n, py, depth) => {
    const v = String(n.properties.var_name ?? 'i')
    const body = n.slots.body ?? []
    const from = n.slots.from?.[0], to = n.slots.to?.[0]
    const inclusive = String(n.properties.inclusive ?? '').toUpperCase() === 'TRUE'
    // range 的上界只算一次、迴圈變數每圈重設；C++ 每圈重算上界、本體改了迴圈變數下一圈看得到（453：`if (i == 1) n = 3` 兩邊印的不同，都 accept）。
    // 本體可能改上界或迴圈變數（mayWrite：寧可多報）、或上界本身是函式呼叫 ⟹ 不能用 range
    const unsafe = mayWrite(body, new Set([v, ...namesIn(to)]), py) || [...namesIn(to)].some((x) => py.isUserFunction(x))
    if (!unsafe) {
      const end = inclusive ? `${paren(to, py)} + 1` : py.expr(to)
      const head = from?.properties?.value === '0' && !from.slots?.left ? `range(${end})` : `range(${py.expr(from)}, ${end})`
      return [`${py.indent(depth)}for ${py.name(v)} in ${head}:`, ...py.block(body, depth + 1)]
    }
    // 寫成 while：每圈重算上界、看得到本體對迴圈變數的修改——與 C++ 同義；而 continue 會跳過最後那句 += 1 ⟹ 有 continue 就保留
    if (hasOwnContinue(body)) return [py.keep(n, 'outside-subset', `迴圈的上界或迴圈變數 ${v} 在本體裡可能被改，而本體有 continue（寫成 while 會跳過遞增）`)]
    const name = py.name(v)
    return [
      `${py.indent(depth)}${name} = ${py.expr(from)}`,
      `${py.indent(depth)}while ${name} ${inclusive ? '<=' : '<'} ${paren(to, py)}:`,
      ...py.block(body, depth + 1).filter((l) => l !== `${py.indent(depth + 1)}pass`),
      `${py.indent(depth + 1)}${name} += 1`,
    ]
  })
}
