/**
 * `cpp:class_declare` 的 **formalize** 路——照 cella 參照翻譯 `tools/cfamily/cpp_to_tree.py` 的 CXXRecordDecl 那一段：
 *
 * ```
 * 程式裡之後有同名的定義   → 不送任何項目（「the definition is the item」）
 * 從未定義（只拿來宣告指標）→ iClassDecl { n, name, isClass }
 * ```
 *
 * 「有沒有定義」問引擎收集的類別名（class_def／struct_declare 各自用 definesType 登記的）。
 * C 的程式（`struct Node;`）：之後有定義時照樣不送；從未定義時 C 的那一側的建構子這一刀沒有對過 ⟹ 照實標 unknown，不猜。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:class_declare', (n, f) => {
    const name = String(n.properties?.name ?? '')
    if (f.isStructName(name)) return []
    if (f.options.isC) { f.miss(n, 'C 的程式裡一個從未定義的 struct 前置宣告——C 那一側的建構子還沒有對過'); return [] }
    return [f.k('iClassDecl', { n: n.id, name, isClass: n.properties?.keyword !== 'struct' })]
  })
  // 宣告了一個型別名（`Helper*` 才認得 Helper）——但不是定義，所以用 declaresType 不用 definesType
  r.declaresType('cpp:class_declare', (n) => String(n.properties?.name ?? ''))
}
