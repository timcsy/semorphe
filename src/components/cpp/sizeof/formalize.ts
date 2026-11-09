/** `cpp:sizeof` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:sizeof', (n, f) => {
    // 對象是運算式（`sizeof a.bytes`、`sizeof(a[0])`）：接點 `expr` 照一般運算式翻（355——以前是文字、靠正規式拆）
    if (f.one(n, 'expr')) return f.k('eSizeofE', { n: n.id, e: f.exprOf(n, 'expr') })
    // `target` 是文字屬性：是型別名就翻；是變數或運算式就照實標 unknown（不從文字猜結構）
    const tt = String(n.properties?.target ?? '').trim()
    // 其餘的型別（`union U`、typedef 的名字、`int*`）：不是宣告過的變數、而型別那一格認得它（只問、不記 unknown）——2026-11-08，C 盲測第二輪
    // 程式裡定義過的型別名（struct／class、union、enum——C++ 不必寫關鍵字）：作用域會把名字解析到那個定義，所以先問「它是不是型別」
    const isType = f.scalar(tt) !== undefined || /^(?:struct\s+)?[A-Za-z_]\w*$/.test(tt) && (tt.startsWith('struct ') || f.isTypeName(tt))
      || (!f.declOf(n.id) && f.isTypeText(tt))
    if (isType) return f.k('eSizeof', { n: n.id, t: f.type(tt, n) })
    // 字面量（`sizeof(1)`、`sizeof(1.0)`、`sizeof(true)`，學生在量型別大小）：值就是那個字面量型別的大小 ⟹ 送型別（第 213 刀）
    const litType = /^\d+$/.test(tt) ? 'int' : /^\d+[lL]{2}$/.test(tt) ? 'long long' : /^\d+\.\d*$/.test(tt) ? 'double'
      : /^(?:true|false)$/.test(tt) ? 'bool' : /^'.'$/.test(tt) ? 'char' : undefined
    if (litType) return f.k('eSizeof', { n: n.id, t: f.type(litType, n) })
    // 單一個變數名（`sizeof(a)`，學生量陣列大小）：指得到宣告就是 eSizeofE（第 207 刀）
    if (f.declOf(n.id)) return f.k('eSizeofE', { n: n.id, e: f.k('eName', { n: `${n.id}/e`, name: tt }) })
    return f.miss(n, `\`sizeof(${tt})\` 的對象不是型別名也不是一個宣告過的變數`)
  })
  // 作用域：對象是運算式就走接點；是單一個名字時照常解析（型別名指不到宣告，不影響）
  r.scope('cpp:sizeof', (n, w) => {
    if (n.slots?.expr?.length) return w.walkSlot(n, 'expr')
    const tt = String(n.properties?.target ?? '').trim()
    if (/^[A-Za-z_]\w*$/.test(tt)) w.resolveIfDeclared(n.id, tt)
  })
}
