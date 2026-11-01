/** `cpp:struct_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:struct_declare', (n, f) => {
    const fields: CellaJson[] = []
    const methods: CellaJson[] = []
    // `int x, y;` 在 lift 成一顆 `_multi_field`、裡面是平行的宣告（產碼那一路也是攤平，見 generators/declarations.ts）⟹ 這裡同樣攤平（第 213 刀）
    const members = (n.slots?.members ?? []).flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
    for (const m of members) {
      // 成員之間的註解不是成員（spec 199）
      if (/:(comment|block_comment)$/.test(m.componentId)) continue
      // 沒有型別的是成員函式（含運算子多載）：由那顆元件自己翻成 mbMethod（spec 201）
      if (m.properties?.type === undefined) { const x = f.member(m); if (x) methods.push(x); continue }
      const t = f.type(m.properties?.type, m)
      if (t) fields.push(f.k('mbField', { acc: f.k('acPublic'), name: String(m.properties?.name ?? ''), t, init: null }))
    }
    if (f.options.isC && methods.length > 0) return [f.miss(n, 'C 的 struct 沒有成員函式')]
    if (f.options.isC) {
      const cFields = fields.map((x) => f.k('fld', { name: x.name, t: x.t }))
      return [f.k('iStruct', { d: f.k('sdef', { n: n.id, name: String(n.properties?.name ?? ''), fields: cFields }) })]
    }
    return [f.k('iClass', { d: f.k('cdef', { n: n.id, name: String(n.properties?.name ?? ''), isClass: false, bases: [], members: [...fields, ...methods] }) })]
  })
  // 定義了一個型別名：不帶關鍵字的 `Node*` 要先認得 `Node`
  r.definesType('cpp:struct_declare', (n) => String(n.properties?.name ?? ''))
}
