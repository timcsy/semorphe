/** `cpp:set_declare` 的 **formalize** 路（spec 194）——`set<T> s;` → `tTemplate "set" [T]`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`，cella 0.1.202610312349 起有這些容器）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:set_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type ?? 'int', n)
    if (!elem) return []
    const source = f.one(n, 'source')
    // 🔴 沒有初始值＝**預設建構**（`sDeclC … []`），不是「未初始化」——送 `sDecl` 而 `init: null` 的話 Cella 判讀到不確定的值（spec 194 量到）
    // multiset：同 set 的送法、名字換掉（cella 2026-11-01：insert、find、count、size、begin／end；erase 兩者都還沒有）
    const t = f.k('tTemplate', { name: String(n.properties?.unique ?? 'true') === 'false' ? 'multiset' : 'set', args: [elem] })
    if (!source) return f.declCtor(n, t, [], global)
    // 一段範圍（第 403 刀）：兩個建構引數照原樣交給 Cella，由它依型別找到範圍建構子
    if (f.one(n, 'source_end')) return f.declCtor(n, t, [f.exprOf(n, 'source'), f.exprOf(n, 'source_end')], global)
    // `set<int> s{5,1,9}`：大括號串列要走它自己登記的初值形狀（iL）——原本一律包成 `iE`，Cella 不知道那個串列初始化的是什麼型別（spec 199 量到 unknown）
    return f.declInit(n, t, f.initOf(source), global)
  })
}
