/**
 * `cpp:union_declare` 的 **formalize** 路（2026-11-08）：頂層送 `iUnion{d: sdef}`，sdef 與 C 的結構同形（cella 2026-11-08）。
 * 型別名由 `definesUnion` 登記——之後的 `union U u`（C）／`U u`（C++）送 `tUnion`。
 * ⚠️ C++ 的 union 在 Cella 那邊是同一個形狀嗎還沒問過——照送，判不出由 Cella 回答（不在這裡替它決定）。
 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

const unionName = (n: { properties?: Record<string, unknown> }): string =>
  String(n.properties?.name ?? '') || String(n.properties?.typedef_alias ?? '')

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:union_declare', (n, f) => {
    const fields: CellaJson[] = []
    const members = (n.slots?.members ?? []).flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
    for (const m of members) {
      if (/:(comment|block_comment)$/.test(m.componentId)) continue
      const t = m.slots?.size !== undefined ? ((f.decl(m, false)[0]?.t as CellaJson | undefined) ?? null) : f.type(m.properties?.type, m)
      if (!t) return []
      fields.push(f.k('fld', { name: String(m.properties?.name ?? ''), t }))
    }
    return [f.k('iUnion', { d: f.k('sdef', { n: n.id, name: unionName(n), fields }) })]
  })
  r.definesUnion('cpp:union_declare', (n) => unionName(n))
  r.definesMacro('cpp:union_declare', (n) => {
    const alias = String(n.properties?.typedef_alias ?? '')
    const tag = String(n.properties?.name ?? '')
    return alias && tag && alias !== tag ? { name: alias, value: `union ${tag}` } : null
  })
}
