/**
 * `cpp:destructor_define` 的 **formalize** 路（第 322 刀）——類別外的定義在頂層**不送**：由類別裡那一行原型帶進類別成員
 *（Cella 的參照翻譯：`if k in OUTSIDE_KINDS and d.get("previousDecl"): return None`）。類別裡沒有對應的原型 → 照實標翻不出。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { DESTRUCTOR_KEY } from '../../../languages/cpp/member-key'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:destructor_define', (n) => ({ className: String(n.properties?.class_name ?? ''), key: DESTRUCTOR_KEY }))
  r.item('cpp:destructor_define', (n, f) => {
    if (f.options.isC) return [f.miss(n, 'C 沒有類別')]
    if (!f.hasInClassDeclaration(n)) return [f.miss(n, `類別 ${String(n.properties?.class_name ?? '')} 裡找不到這個解構子的宣告（參數型別要一致）`)]
    return []
  })
  r.scope('cpp:destructor_define', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'body')
  }))
}
