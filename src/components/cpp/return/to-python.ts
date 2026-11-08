/** `cpp:return` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt('cpp:return', (n, py, depth) => {
    if (py.inMain) {
      // 最後一句 `return 0;` 已由 func_def 那顆拿掉；走到這裡的是中途結束程式（後面的不會跑）——第一版不換
      return [py.keep(n, 'outside-subset', 'main 中途 return（程式在這裡結束）')]
    }
    const v = n.slots.value?.[0]
    return [`${py.indent(depth)}return${v ? ` ${py.expr(v)}` : ''}`]
  })
}
