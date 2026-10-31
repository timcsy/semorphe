/** `cpp:array_2d_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_2d_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const rows = f.constInt(f.one(n, 'rows')), cols = f.constInt(f.one(n, 'cols'))
    if (rows === null || cols === null) { f.miss(n, '二維陣列的長度不是整數字面'); return [] }
    const t = f.k('tArr', { t: f.k('tArr', { t: elem, n: cols }), n: rows })
    const init = (n.slots?.values ?? []).length > 0 ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
