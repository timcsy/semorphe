/** `cpp:input` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 運算式位置：`while (cin >> n)`、`if (!(cin >> x))`——cin 的值拿來當條件（spec 199：學生的程式 17 支這樣讀到檔尾）
  r.expr('cpp:input', (n, f) => f.k('eCin', { n: n.id, targets: (n.slots?.values ?? []).map((c) => f.expr(c)) }))
  r.stmt('cpp:input', (n, f) =>
    [f.k('sExpr', { n: `${n.id}/stmt`, e: f.k('eCin', { n: n.id, targets: (n.slots?.values ?? []).map((c) => f.expr(c)) }) })])
}
