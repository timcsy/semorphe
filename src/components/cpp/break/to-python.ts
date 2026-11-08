/** `cpp:break` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt('cpp:break', (_n, py, depth) => [`${py.indent(depth)}break`])
}
