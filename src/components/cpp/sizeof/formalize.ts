/** `cpp:sizeof` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:sizeof', (n, f) => {
    // `target` 是文字屬性：是型別名就翻；是變數或運算式就照實標 unknown（不從文字猜結構）
    const tt = String(n.properties?.target ?? '').trim()
    const isType = f.scalar(tt) !== undefined || /^(?:struct\s+)?[A-Za-z_]\w*$/.test(tt) && (tt.startsWith('struct ') || f.isStructName(tt))
    return isType ? f.k('eSizeof', { n: n.id, t: f.type(tt, n) }) : f.miss(n, '`sizeof` 的對象是文字屬性，而且不是型別名（還沒升格成運算式槽）')
  })
}
