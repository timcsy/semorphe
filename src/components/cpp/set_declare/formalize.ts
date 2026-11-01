/** `cpp:set_declare` 的 **formalize** 路（spec 194）——`set<T> s;` → `tTemplate "set" [T]`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`，cella 0.1.202610312349 起有這些容器）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:set_declare', (n, f, global) => {
    if (String(n.properties?.unique ?? 'true') === 'false') return [f.miss(n, 'multiset 還沒有對應')]
    const elem = f.type(n.properties?.type ?? 'int', n)
    if (!elem) return []
    const source = f.one(n, 'source')
    // 🔴 沒有初始值＝**預設建構**（`sDeclC … []`），不是「未初始化」——送 `sDecl` 而 `init: null` 的話 Cella 判讀到不確定的值（spec 194 量到）
    const t = f.k('tTemplate', { name: 'set', args: [elem] })
    return source ? f.declInit(n, t, f.k('iE', { e: f.expr(source) }), global) : f.declCtor(n, t, [], global)
  })
}
