/** `cpp:array_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const len = f.constInt(f.one(n, 'size'))
    if (len === null) { f.miss(n, '陣列長度不是整數字面（VLA 或常數名字還沒有對應）'); return [] }
    const t = f.k('tArr', { t: elem, n: len })
    const init = (n.slots?.values ?? []).length > 0 ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
