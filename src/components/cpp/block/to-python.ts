/** 這顆元件寫成 Python（467：switch 的 `case 2: { … break; }` 最常見）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `{ … }` → 本體攤平在同一層：Python 沒有區塊作用域，裡面宣告的名字與外層同名時由 func_def 的同名檢查保留（每一個子槽是一層新的作用域）
  r.stmt((n, py, depth) => {
    const lines = py.block(n.slots.body, depth).filter((l) => l.trim() !== 'pass')
    return lines.length ? lines : [`${py.indent(depth)}pass`]
  })
}
