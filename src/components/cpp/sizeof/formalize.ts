/** `cpp:sizeof` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:sizeof', (n, f) => {
    // `target` 是文字屬性：是型別名就翻；是變數或運算式就照實標 unknown（不從文字猜結構）
    const tt = String(n.properties?.target ?? '').trim()
    const isType = f.scalar(tt) !== undefined || /^(?:struct\s+)?[A-Za-z_]\w*$/.test(tt) && (tt.startsWith('struct ') || f.isStructName(tt))
    if (isType) return f.k('eSizeof', { n: n.id, t: f.type(tt, n) })
    // 字面量（`sizeof(1)`、`sizeof(1.0)`、`sizeof(true)`，學生在量型別大小）：值就是那個字面量型別的大小 ⟹ 送型別（第 213 刀）
    const litType = /^\d+$/.test(tt) ? 'int' : /^\d+[lL]{2}$/.test(tt) ? 'long long' : /^\d+\.\d*$/.test(tt) ? 'double'
      : /^(?:true|false)$/.test(tt) ? 'bool' : /^'.'$/.test(tt) ? 'char' : undefined
    if (litType) return f.k('eSizeof', { n: n.id, t: f.type(litType, n) })
    // 單一個變數名（`sizeof(a)`，學生量陣列大小）：指得到宣告就是 eSizeofE（第 207 刀）；
    // `sizeof(a[0])`（下標是整數字面）：一個元素的大小（第 213 刀）；其餘的運算式仍照實標 unknown
    const x = f.declOf(n.id)
    const idx = /^[A-Za-z_]\w*\s*\[\s*(\d+)\s*\]$/.exec(tt)
    if (x && idx) {
      return f.k('eSizeofE', { n: n.id, e: f.k('eIndex', { n: `${n.id}/e`, a: f.k('eName', { n: `${n.id}/a`, name: /^[A-Za-z_]\w*/.exec(tt)![0] }), i: f.k('eNum', { n: `${n.id}/i`, v: Number(idx[1]) }) }) })
    }
    if (x) return f.k('eSizeofE', { n: n.id, e: f.k('eName', { n: `${n.id}/e`, name: tt }) })
    return f.miss(n, `\`sizeof(${tt})\` 的對象是文字屬性，而且不是型別名也不是一個變數（還沒升格成運算式槽）`)
  })
  // 作用域：對象是單一個名字時照常解析（型別名指不到宣告，不影響）
  r.scope('cpp:sizeof', (n, w) => {
    const tt = String(n.properties?.target ?? '').trim()
    const name = /^([A-Za-z_]\w*)(?:\s*\[\s*\d+\s*\])?$/.exec(tt)
    if (name) w.resolveIfDeclared(n.id, name[1])
  })
}
