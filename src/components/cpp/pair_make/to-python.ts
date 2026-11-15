/**
 * 這顆元件寫成 Python（465）：`make_pair(a, b)` → `(a, b)`（pair 換成 tuple，理由見 pair_declare 那顆）。
 * 型別照引數推（同 C++ 的 make_pair）；字元的保留（Python 用字串表示 char，make_pair('a', 1) 的 first 是整數 97 還是 'a' 要看用在哪裡）
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const a = n.slots.first?.[0]
    const b = n.slots.second?.[0]
    if (isChar(py.typeOf(a)) || isChar(py.typeOf(b))) return py.keep(n, 'char', 'make_pair 的引數是 char')
    return `(${py.expr(a)}, ${py.expr(b)})`
  })
}
