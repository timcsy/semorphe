/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    if (py.inMain) {
      // 最後一句 `return 0;` 已由 func_def 那顆拿掉；走到這裡的是中途結束程式（後面的不會跑）
      // ⟹ raise SystemExit（`import sys` 與 `exit()` Cella 的 Python 家族還不支援）。非零的結束碼：判決裡比不到，第一版不換
      const r = n.slots.value?.[0]
      if (r && py.expr(r) !== '0') return [py.keep(n, 'outside-subset', 'main 中途 return 非零的結束碼')]
      return [`${py.indent(depth)}raise SystemExit`]
    }
    const v = n.slots.value?.[0]
    return [`${py.indent(depth)}return${v ? ` ${py.expr(v)}` : ''}`]
  })
}
