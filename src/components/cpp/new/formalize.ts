/** `cpp:new` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:new', (n, f) => {
    const t = f.type(n.properties?.type, n)
    if (!t) return f.k('eHole', { n: n.id })
    if (f.one(n, 'size')) return f.k('eNewArr', { n: n.id, t, len: f.exprOf(n, 'size'), zero: false })
    // 🔴 `new T(args)` 的引數今天是**文字屬性**（已知缺口：還沒升格成運算式槽）——不從文字猜結構
    if (String(n.properties?.args ?? '') !== '') return f.miss(n, '`new T(…)` 的引數是文字屬性，還沒升格成運算式槽')
    // `new T{}`（空的大括號）＝值初始化，同 `new T()`
    if (n.properties?.brace === 'true') return f.k('eNew', { n: n.id, t, args: [] })
    // `new T()`（空括號）＝值初始化：送空的引數串列；`new T`＝預設初始化：null（cpp_to_tree.py 同形）
    return f.k('eNew', { n: n.id, t, args: n.properties?.valueInit === 'true' ? [] : null })
  })
}
