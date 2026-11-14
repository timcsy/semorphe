/** 這顆元件寫成 Python（467）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isSignedInt, isSimple } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `~x` → `~x`：有號整數是二補數（C++20 定死了），~x ＝ -x - 1，Python 的整數同義。
  // 只收有號整數：無號的 C++ 繞回成很大的數（`~0u` 是 4294967295）、Python 是 -1；bool、char 先整數提升，不猜
  r.expr((n, py) => {
    const v = n.slots.operand?.[0]
    const t = py.typeOf(v)
    if (!isSignedInt(t)) return py.keep(n, 'outside-subset', `位元反轉 ~（型別 ${t ?? '不知道'}）還沒有對應`)
    const e = py.expr(v)
    return isSimple(v) && !e.startsWith('-') ? `~${e}` : `~(${e})`
  })
}
