/**
 * `cpp:method_define` 的 **formalize** 路（第 322 刀）——類別外的定義在頂層**不送**：本體由類別裡那一行原型帶進 `mbMethod`
 *（Cella 的參照翻譯：`if k in OUTSIDE_KINDS and d.get("previousDecl"): return None`）。
 * 類別裡沒有對應的原型（C++ 不合法：沒有這個成員）→ 照實標翻不出，不猜成一個頂層函式。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { memberKeyOf } from '../../../languages/cpp/member-key'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:method_define', (n) => ({ className: String(n.properties?.class_name ?? ''), key: memberKeyOf(n) }))
  r.item('cpp:method_define', (n, f) => {
    if (f.options.isC) return [f.miss(n, 'C 沒有類別')]
    if (!f.hasInClassDeclaration(n)) return [f.miss(n, `類別 ${String(n.properties?.class_name ?? '')} 裡找不到 ${String(n.properties?.name ?? '')} 這個成員的宣告（名字、參數型別、const 要一致）`)]
    return []
  })
  // 作用域：參數與本體同一層（同類別裡定義方法那顆）
  r.scope('cpp:method_define', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
