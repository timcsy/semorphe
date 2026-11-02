/** `cpp:input` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

/**
 * spec 203：`in >> a` 從具名串流（`istringstream in(...)`）讀——lift 成同一顆 input、`from` 記著串流名。
 * eCin 讀的是標準輸入：照送的話會**靜靜地讀錯來源**（stdin 是空的 ⟹ 值沒變），所以照實標翻不出（Cella 的字串串流的送法還沒定）。
 */
const fromNamed = (n: { properties?: Record<string, unknown> }): boolean => typeof n.properties?.from === 'string' && n.properties.from !== ''

export function registerFormalize(r: FormalizeRegistrar): void {
  // 運算式位置：`while (cin >> n)`、`if (!(cin >> x))`——cin 的值拿來當條件（spec 199：學生的程式 17 支這樣讀到檔尾）
  r.expr('cpp:input', (n, f) => fromNamed(n) ? f.miss(n, '從具名串流讀（istringstream）還沒有對應') : f.k('eCin', { n: n.id, targets: (n.slots?.values ?? []).map((c) => f.expr(c)) }))
  r.stmt('cpp:input', (n, f) => fromNamed(n) ? [f.k('sExpr', { n: `${n.id}/stmt`, e: f.miss(n, '從具名串流讀（istringstream）還沒有對應') })] :
    [f.k('sExpr', { n: `${n.id}/stmt`, e: f.k('eCin', { n: n.id, targets: (n.slots?.values ?? []).map((c) => f.expr(c)) }) })])
}
