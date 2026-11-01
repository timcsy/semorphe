/** `cpp:initializer_list` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 大括號初值串列——巢狀的（`{{1,2},{3,4}}`）遞迴成 iL
  r.init('cpp:initializer_list', (n, f) => f.k('iL', { n: n.id, xs: (n.slots?.values ?? []).map((c) => f.initOf(c)) }))
  // 運算式位置（`v.push_back({a, b})`、`return {a, b}`、`min({a, b, c})`）：eBraced 包一個 iL（cella 2026-11-01 給的形狀；
  // 照目標型別做 copy-list-initialization，多載有歧義、元素裡又有大括號由 Cella 判 unknown）
  r.expr('cpp:initializer_list', (n, f) => f.k('eBraced', { n: n.id, init: f.k('iL', { n: `${n.id}/init`, xs: (n.slots?.values ?? []).map((c) => f.initOf(c)) }) }))
}
