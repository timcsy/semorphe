/** `cpp:pair_declare` 的 **formalize** 路（第 209 刀：`pair<int,int> p = make_pair(1, 2);`——量結構化繫結時發現它沒有翻譯）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:pair_declare', (n, f, global) => {
    const a = f.type(n.properties?.type1 ?? 'int', n)
    const b = f.type(n.properties?.type2 ?? 'int', n)
    if (!a || !b) return []
    const t = f.k('tTemplate', { name: 'pair', args: [a, b] })
    const source = f.one(n, 'source')
    // 沒有初值＝預設建構（同 map_declare：送 sDecl 而 init: null 會被判讀到不確定的值）
    return source ? f.declInit(n, t, f.initOf(source), global) : f.declCtor(n, t, [], global)
  })
}
