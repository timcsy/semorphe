/** `cpp:pointer_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:pointer_declare', (n, f, global) => {
    // 類別外的靜態成員定義（`L* L::current = nullptr;`）：同 var_declare 那一條——初值要併進類別的靜態成員，那一步還沒做 ⟹ 照實翻不出。
    //    送成一個叫 `L::current` 的全域指標的話，類別裡那個靜態成員拿不到它（360 的盲測：Cella 因此判錯的 reject）
    if (String(n.properties?.name ?? '').includes('::')) { f.miss(n, '類別外的靜態成員定義（初值要併進類別的靜態成員）還沒有對應'); return [] }
    const base = f.type(n.properties?.type, n)
    if (!base) return []
    return f.declVar(n, f.k('tPtr', { t: base }), global)
  })
}
