/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 頂層：照順序寫；#include／using 各自登記成「不寫」，main 的本體攤平（func_def 那顆負責）
  r.stmt((n, py) => (n.slots.body ?? []).flatMap((c) => py.block([c], 0).filter((l) => l.trim() !== 'pass')))
}
