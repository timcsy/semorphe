/** `cpp:map_declare` 的 **formalize** 路（spec 194）——`map<K, V> m;` → `tTemplate "map" [K, V]`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`，cella 0.1.202610312349 起有這些容器）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:map_declare', (n, f, global) => {
    // multimap 照實標 unknown；unordered_map 照 cella 2026-11-01 給的送法（tTemplate "unordered_map"，Cella 補上之前它判 unknown）
    if (String(n.properties?.unique ?? 'true') === 'false') return [f.miss(n, 'multimap 還沒有對應')]
    const name = String(n.properties?.ordered ?? 'true') === 'false' ? 'unordered_map' : 'map'
    const key = f.type(n.properties?.key_type ?? 'int', n)
    const value = f.type(n.properties?.value_type ?? 'int', n)
    if (!key || !value) return []
    const source = f.one(n, 'source')
    // 🔴 沒有初始值＝**預設建構**（`sDeclC … []`），不是「未初始化」——送 `sDecl` 而 `init: null` 的話 Cella 判讀到不確定的值（spec 194 量到）
    const t = f.k('tTemplate', { name, args: [key, value] })
    return source ? f.declInit(n, t, f.k('iE', { e: f.expr(source) }), global) : f.declCtor(n, t, [], global)
  })
}
