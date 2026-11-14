/** 這顆元件寫成 Python（453）：`static_cast<T>(x)`——判準同 C 風格轉型（`castToPython`）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { castToPython } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => castToPython(n, py))
}
