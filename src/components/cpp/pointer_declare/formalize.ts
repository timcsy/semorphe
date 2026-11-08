/** `cpp:pointer_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:pointer_declare', (n, f, global) => {
    // 類別外的靜態成員定義（`L* L::current = nullptr;`）：同 var_declare 那一條——初值要併進類別的靜態成員，那一步還沒做 ⟹ 照實翻不出。
    //    送成一個叫 `L::current` 的全域指標的話，類別裡那個靜態成員拿不到它（360 的盲測：Cella 因此判錯的 reject）
    const qn = String(n.properties?.name ?? '')
    if (qn.includes('::')) {
      // 361：初值已併進類別的 mbStatic——這一份不另外送；找不到對應成員才照實標翻不出
      if (f.isClassMember(qn)) return []
      f.miss(n, '類別外的靜態成員定義找不到對應的類別成員'); return []
    }
    const base = f.type(n.properties?.type, n)
    if (!base) return []
    return f.declVar(n, f.k('tPtr', { t: base }), global)
  })
}
