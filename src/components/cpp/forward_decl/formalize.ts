/** `cpp:forward_decl` 的 **formalize** 路（spec 199：6.0 量到學生的程式 10 支先宣告函式再定義）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式的前置宣告不產生程式：定義在後面，呼叫照名字找（cpp_to_tree.py 也丟掉它——`if self.forward(d): return None`）
  r.item('cpp:forward_decl', () => [])
  r.stmt('cpp:forward_decl', () => [])
}
