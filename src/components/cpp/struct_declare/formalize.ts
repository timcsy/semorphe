/** `cpp:struct_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:struct_declare', (n, f) => {
    const fields: CellaJson[] = []
    for (const m of n.slots?.members ?? []) {
      const t = f.type(m.properties?.type, m)
      if (t) fields.push(f.k('mbField', { acc: f.k('acPublic'), name: String(m.properties?.name ?? ''), t, init: null }))
    }
    if (f.options.isC) {
      const cFields = fields.map((x) => f.k('fld', { name: x.name, t: x.t }))
      return [f.k('iStruct', { d: f.k('sdef', { n: n.id, name: String(n.properties?.name ?? ''), fields: cFields }) })]
    }
    return [f.k('iClass', { d: f.k('cdef', { n: n.id, name: String(n.properties?.name ?? ''), isClass: false, bases: [], members: fields }) })]
  })
  // 定義了一個型別名：不帶關鍵字的 `Node*` 要先認得 `Node`
  r.definesType('cpp:struct_declare', (n) => String(n.properties?.name ?? ''))
}
