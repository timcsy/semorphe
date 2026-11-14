/** 這顆元件寫成 Python（456）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar, isSimple } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `-x` → `-x`：有號整數與浮點兩邊同義（-0.0 也是）；`-INT_MIN` 這類溢位是未定義行為，Cella 先判出來。
  // 運算元不是單一名字或字面量就加括號（`-(a + b)`；`-!x` 在 Python 要寫成 `-(not x)`），字面量本身帶負號也加（`-(-3)`）
  r.expr((n, py) => {
    const v = n.slots.value?.[0]
    const t = py.typeOf(v) ?? ''
    // char：Python 用長度 1 的字串，不能取負；無號整數：C++ 繞回成很大的數、Python 不會
    if (isChar(t)) return py.keep(n, 'char', 'char 取負號')
    if (/unsigned|size_t/.test(t)) return py.keep(n, 'outside-subset', `無號整數取負號（型別 ${t}）：C++ 會繞回、Python 不會`)
    const e = py.expr(v)
    return isSimple(v) && !e.startsWith('-') ? `-${e}` : `-(${e})`
  })
}
