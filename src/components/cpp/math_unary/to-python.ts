/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // sqrt → math.sqrt、abs／fabs → abs。⚠️ sqrt 的負數：C++ 得 nan、Python 丟例外——判決只在給定的輸入上證明相同（research R9）
  // floor／ceil 等：C++ 回傳浮點、Python 回傳整數，後續運算會不同 ⟹ 第一版不換
  r.expr((n, py) => {
    const f = String(n.properties.func ?? '')
    const v = py.expr(n.slots.value?.[0])
    if (f === 'sqrt') return `${py.useImport('math')}.sqrt(${v})`
    if (f === 'abs' || f === 'fabs') return `abs(${v})`
    return py.keep(n, 'outside-subset', `${f}(…) 的回傳型別兩個語言不同（或還沒有對應）`)
  })
}
