/** `cpp:builtin_constant` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:builtin_constant', (n, f) => {
    const v = String(n.properties?.value ?? '')
    if (v === 'true' || v === 'false') return f.k('eBool', { n: n.id, b: v === 'true' })
    // 🔴 空指標是語法裡的字面量，不是一個名字（第 394 刀：送 eConst 時 Cella 判「未宣告的 nullptr」）
    if (v === 'nullptr') return f.k('eNullptr', { n: n.id })
    if (v === 'NULL') return f.k('eNull', { n: n.id })
    return f.k('eConst', { n: n.id, name: v })
  })
}
