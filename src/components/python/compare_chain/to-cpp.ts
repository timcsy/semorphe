/**
 * 這顆元件寫成 C++（446）。`a < b < c` 在 Python 是「a < b 而且 b < c」，中間那一項只算一次；
 * C++ 的 `a < b < c` 是 `(a < b) < c`（先比出真假再拿去比 c）——意思完全不同，所以拆成 `a < b && b < c`。
 * 拆開之後中間那一項會被算兩次，所以只收沒有副作用、算兩次也一樣的（名字、數字或字串字面量）。
 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

const OPS = ['==', '!=', '<', '>', '<=', '>=']
const pure = (n: SemanticNode | undefined): boolean => !!n && /:(var_ref|literal_number|literal_string)$/.test(n.componentId)

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    if ((n.slots.more ?? []).length > 0) return cpp.keep(n, 'outside-subset', '三段以上的連續比較還沒有對應')
    const op1 = String(n.properties.operator ?? ''), op2 = String(n.properties.operator2 ?? '')
    if (!OPS.includes(op1) || !OPS.includes(op2)) return cpp.keep(n, 'outside-subset', `比較運算子 ${op1}、${op2} 還沒有對應`)
    const [l, m, rt] = [n.slots.left?.[0], n.slots.middle?.[0], n.slots.right?.[0]]
    if (!pure(m)) return cpp.keep(n, 'outside-subset', '連續比較的中間那一項不是名字或字面量（拆開後會被算兩次）')
    const ts = [l, m, rt].map((x) => cpp.pyType(x))
    const num = (t: string | undefined) => t === 'int' || t === 'float' || t === 'bool'
    if (!(ts.every(num) || ts.every((t) => t === 'str'))) return cpp.keep(n, 'type-uncertain', `連續比較的三項型別（${ts.map((t) => t ?? '?').join('、')}）`)
    return `${paren(l, cpp)} ${op1} ${paren(m, cpp)} && ${paren(m, cpp)} ${op2} ${paren(rt, cpp)}`
  })
}
