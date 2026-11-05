/**
 * `cpp:this` 的 **formalize** 路——`eThis`（Cella 的參照翻譯 `tools/cfamily/cpp_to_tree.py`：`CXXThisExpr` → `eThis`）。
 * `this->x` 由「指標的欄位」送 `eArrow{a: eThis}`、`this->f()` 由方法呼叫送 `eMCall{obj: eThis, arrow: true}`、`*this` 由取值送——都經由 `exprOf` 接上這一支。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:this', (n, f) => f.k('eThis', { n: n.id }))
}
