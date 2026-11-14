/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 頂層：照順序寫；#include／using 各自登記成「不寫」，main 的本體攤平（func_def 那顆負責）
  // 只濾掉頂層那一行 pass（block 給每一顆頂層項目補的）；縮排的 pass 是 if／while 空本體的（453：原本 trim() 之後一起濾掉，`if (x) {}` 換成不合法的 Python）
  r.stmt((n, py) => (n.slots.body ?? []).flatMap((c) => py.block([c], 0).filter((l) => l !== 'pass')))
}
