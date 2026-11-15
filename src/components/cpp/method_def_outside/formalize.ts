/**
 * `cpp:method_def_outside` 的 **formalize** 路（第 322 刀）——類別外的定義在頂層**不送**：本體由類別裡那一行原型帶進 `mbMethod`
 *（Cella 的參照翻譯：`if k in OUTSIDE_KINDS and d.get("previousDecl"): return None`）。
 * 類別裡沒有對應的原型（C++ 不合法：沒有這個成員）→ 照實標翻不出，不猜成一個頂層函式。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { memberKeyOf } from '../../../languages/cpp/member-key'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:method_def_outside', (n) => ({ className: String(n.properties?.class_name ?? ''), key: memberKeyOf(n) }))
  r.item('cpp:method_def_outside', (n, f) => {
    if (f.options.isC) return [f.miss(n, 'C 沒有類別')]
    if (!f.hasInClassDeclaration(n)) return [f.miss(n, `類別 ${String(n.properties?.class_name ?? '')} 裡找不到 ${String(n.properties?.name ?? '')} 這個成員的宣告（名字、參數型別、const 要一致）`)]
    const at = f.memberAt(n)!
    // 480：配對的鍵是名字、參數型別、const，不含回傳型別——`long A::f() {}` 對上類別裡的 `int f();` 不是合法的 C++
    //（[class.mfct]：定義要與宣告相符），而照類別裡那一行送會判 accept ⟹ 回傳型別不同時照實標翻不出（不猜哪一邊是對的）
    const declared = f.nodeById(String((at as { x?: unknown }).x ?? ''))
    const norm = (t: unknown): string => String(t ?? '').replace(/\s+/g, '')
    if (declared && declared.properties?.return_type !== undefined && norm(declared.properties.return_type) !== norm(n.properties?.return_type)) {
      return [f.miss(n, `類別外定義的回傳型別「${String(n.properties?.return_type)}」與類別裡的宣告「${String(declared.properties.return_type)}」不同`)]
    }
    return [at] // 本體由類別裡那一行帶進成員，這裡只標「定義寫在這個位置」（395）
  })
  // 作用域：參數與本體同一層（同類別裡定義方法那顆）
  r.scope('cpp:method_def_outside', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
