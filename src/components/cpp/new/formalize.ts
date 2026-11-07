/** `cpp:new` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:new', (n, f) => {
    const t = f.type(n.properties?.type, n)
    if (!t) return f.k('eHole', { n: n.id })
    // `new int[n]()`／`new int[n]{}`＝每格值初始化（歸零）——zero 照實送（元件管線 322；原本一律 false，讀到未初始化的值）
    if (f.one(n, 'size')) return f.k('eNewArr', { n: n.id, t, len: f.exprOf(n, 'size'), zero: n.properties?.valueInit === 'true' || n.properties?.brace === 'true' })
    // `new T(a, b)`／`new T{a, b}`：引數是運算式槽（328，原本是文字屬性、只能回 unknown）
    const args = (n.slots?.args ?? []).map(a => f.expr(a))
    // 大括號（`new Node{v, head}`、`new T{}`）：Cella 0.1.202611070815 起的 `eNewList { n, t, xs }`——xs 是宣告用的大括號初始化（iE、巢狀的 iL），
    //    照 [dcl.init.list] 判（聚合體逐成員、有建構子的找建構子、空的值初始化）。第 333 刀：在此之前大括號帶引數照實回 unknown（eNew 對聚合體判 ubUninit）
    if (n.properties?.brace === 'true') return f.k('eNewList', { n: n.id, t, xs: (n.slots?.args ?? []).map((c) => f.initOf(c)) })
    // 小括號：同 cpp_to_tree.py 的 eNew（n／t／args，引數由 construct_arguments 攤平）
    if (args.length > 0) return f.k('eNew', { n: n.id, t, args })
    // `new T()`（空括號）＝值初始化：送空的引數串列；`new T`＝預設初始化：null（cpp_to_tree.py 同形）
    return f.k('eNew', { n: n.id, t, args: n.properties?.valueInit === 'true' ? [] : null })
  })
}
