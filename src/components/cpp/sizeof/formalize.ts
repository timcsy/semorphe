/** `cpp:sizeof` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:sizeof', (n, f) => {
    // `target` 是文字屬性：是型別名就翻；是變數或運算式就照實標 unknown（不從文字猜結構）
    const tt = String(n.properties?.target ?? '').trim()
    const isType = f.scalar(tt) !== undefined || /^(?:struct\s+)?[A-Za-z_]\w*$/.test(tt) && (tt.startsWith('struct ') || f.isStructName(tt))
    if (isType) return f.k('eSizeof', { n: n.id, t: f.type(tt, n) })
    // 單一個變數名（`sizeof(a)`，學生量陣列大小）：指得到宣告就是 eSizeofE（第 207 刀）；其餘的運算式仍照實標 unknown
    const x = f.declOf(n.id)
    if (x) return f.k('eSizeofE', { n: n.id, e: f.k('eVar', { n: `${n.id}/e`, x }) })
    return f.miss(n, '`sizeof` 的對象是文字屬性，而且不是型別名也不是一個變數（還沒升格成運算式槽）')
  })
  // 作用域：對象是單一個名字時照常解析（型別名指不到宣告，不影響）
  r.scope('cpp:sizeof', (n, w) => {
    const tt = String(n.properties?.target ?? '').trim()
    if (/^[A-Za-z_]\w*$/.test(tt)) w.resolveIfDeclared(n.id, tt)
  })
}
