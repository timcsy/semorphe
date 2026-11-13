/** `cpp:forward_decl` 的 **formalize** 路（spec 199：6.0 量到學生的程式 10 支先宣告函式再定義）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeContext, FormalizeRegistrar } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式的前置宣告不產生程式：定義在後面，呼叫照名字找（cpp_to_tree.py 也丟掉它——`if self.forward(d): return None`）
  // 438：`IRAM_ATTR` 在板子上照一般原型（同函式定義那顆）；不在板子上它不是標準 C++ 的東西，照實翻不出
  const iram = (n: SemanticNode, f: FormalizeContext) =>
    n.properties.attribute && !f.options.board ? [f.miss(n, `「${String(n.properties.attribute)}」是板子核心的巨集，不是標準 C++`)] : []
  r.item('cpp:forward_decl', iram)
  r.stmt('cpp:forward_decl', iram)
}
