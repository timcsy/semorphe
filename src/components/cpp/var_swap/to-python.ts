/** 這顆元件寫成 Python（455）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // swap(a, b) 寫 a 與 b——計次迴圈判「本體可能寫哪些名字」要知道（453 的 mayWrite）
  r.writes((n) => [...(n.slots.left ?? []), ...(n.slots.right ?? [])])
  // swap(a, b) → a, b = b, a（右邊先算完才指定，同 swap）
  r.stmt((n, py, depth) => {
    const a = n.slots.left?.[0]
    const b = n.slots.right?.[0]
    for (const x of [a, b]) {
      if (isChar(py.typeOf(x)) && x?.slots?.index) return [py.keep(n, 'char', '交換字串裡的字元：C++ 的字串可以改、Python 的字串不能')]
    }
    const ta = py.target(a, true)
    const tb = py.target(b, true)
    const before = [ta.before, tb.before].filter((s): s is string => !!s).map((s) => `${py.indent(depth)}${s}`)
    return [...before, `${py.indent(depth)}${ta.text}, ${tb.text} = ${py.expr(b)}, ${py.expr(a)}`]
  })
}
