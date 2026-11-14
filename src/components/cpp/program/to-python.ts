/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { componentTraits } from '../../../core/component/traits'

export function registerToPython(r: ToPythonRegistrar): void {
  // 頂層：照順序寫；#include／using 各自登記成「不寫」，main 的本體攤平（func_def 那顆負責）
  // 只濾掉頂層那一行 pass（block 給每一顆頂層項目補的）；縮排的 pass 是 if／while 空本體的（453：原本 trim() 之後一起濾掉，`if (x) {}` 換成不合法的 Python）
  r.stmt((n, py) => {
    const items = n.slots.body ?? []
    const out = (c: (typeof items)[number]): string[] => py.block([c], 0).filter((l) => l !== 'pass')
    // main 後面還有函式定義（前面先寫了前置宣告，459）：攤平的 main 是頂層的程式，照順序寫會在 def 之前就呼叫 ⟹ NameError。
    //   main 移到最後——C++ 也是先把整個翻譯單元的定義（與全域的初值）都準備好才進 main，所以這樣排才是同一個順序
    const isDef = (c: (typeof items)[number]): boolean => componentTraits(c.componentId)?.functionDefinition === true
    const m = items.findIndex((c) => isDef(c) && py.isEntryFunction(String(c.properties.name ?? '')))
    if (m >= 0 && items.slice(m + 1).some(isDef)) {
      return [...items.filter((_, k) => k !== m).flatMap(out), ...out(items[m])]
    }
    return items.flatMap(out)
  })
}
