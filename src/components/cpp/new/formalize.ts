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
    // 🔴 大括號＋引數（`new Node{v, head}`）先照實回 unknown（2026-11-07，328 量到）：eNew 送給沒有自訂建構子的類別（聚合體）時
    //    Cella 判 ubUninit——`new Node{1, h}`、`new Node()`、`new Node(n)` 三種都是；有建構子的 `new P{5}` 是 accept。
    //    從 unknown 變成誤判 reject 比不送更糟（P6），所以這一種等 Cella 回覆聚合體怎麼送；已附最小重現回報
    if (args.length > 0 && n.properties?.brace === 'true') return f.miss(n, '`new T{…}` 的大括號初始化：聚合體的形狀還沒與 Cella 對好（eNew 對聚合體判 ubUninit）')
    // 小括號：同 cpp_to_tree.py 的 eNew（n／t／args，引數由 construct_arguments 攤平）
    if (args.length > 0) return f.k('eNew', { n: n.id, t, args })
    // `new T{}`（空的大括號）＝值初始化，同 `new T()`
    if (n.properties?.brace === 'true') return f.k('eNew', { n: n.id, t, args: [] })
    // `new T()`（空括號）＝值初始化：送空的引數串列；`new T`＝預設初始化：null（cpp_to_tree.py 同形）
    return f.k('eNew', { n: n.id, t, args: n.properties?.valueInit === 'true' ? [] : null })
  })
}
