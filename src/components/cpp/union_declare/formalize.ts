/**
 * `cpp:union_declare` 的 **formalize** 路（2026-11-08）：頂層送 `iUnion{d: sdef}`，sdef 與 C 的結構同形（cella 2026-11-08）。
 * 型別名由 `definesUnion` 登記——之後的 `union U u`（C）／`U u`（C++）送 `tUnion`。
 * ⚠️ C++ 的 union 在 Cella 那邊是同一個形狀嗎還沒問過——照送，判不出由 Cella 回答（不在這裡替它決定）。
 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

// 沒有標籤也沒有另名（結構裡的匿名成員）：前端合成 C 寫不出來的名字（clang 的叫法；Cella 0959 的形狀，358）
const unionName = (n: { id?: string; properties?: Record<string, unknown> }): string =>
  String(n.properties?.name ?? '') || String(n.properties?.typedef_alias ?? '') || `(unnamed union at ${n.id})`

type Item = Parameters<Parameters<FormalizeRegistrar['item']>[1]>[0]
type Ctx = Parameters<Parameters<FormalizeRegistrar['item']>[1]>[1]

/**
 * 匿名的 union／struct 成員（C11 6.7.2.1p13；Cella 0959，358）：那個定義照舊翻成 iUnion／iStruct（名字是合成的），
 * 用到它的那一格是名字為空字串的 fld、型別指向合成的名字。只有 C——C++ 類別的匿名 union Cella 還沒有做（照實 unknown）。
 * ⚠️ 結構那顆有同一段（兩顆膠囊各自翻自己的成員；判別只問「這個成員本身是不是一個定義」，不問身分）。
 */
export function anonymousMember(m: Item, f: Ctx): { items: CellaJson[]; field: CellaJson } | { miss: CellaJson } {
  if (!f.options.isC) return { miss: f.miss(m, 'C++ 類別裡的匿名 union／struct 還沒有對應（Cella 只做了 C）') }
  const items = f.item(m)
  const def = items[items.length - 1] as { k?: string; d?: { name?: string } } | undefined
  if (!def?.d?.name || (def.k !== 'iUnion' && def.k !== 'iStruct')) return { miss: f.miss(m, '匿名成員的定義翻不出來') }
  return { items, field: f.k('fld', { name: '', t: f.k(def.k === 'iUnion' ? 'tUnion' : 'tStruct', { name: def.d.name }) }) }
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:union_declare', (n, f) => {
    const fields: CellaJson[] = []
    const members = (n.slots?.members ?? []).flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
    const pre: CellaJson[] = []
    for (const m of members) {
      if (/:(comment|block_comment)$/.test(m.componentId)) continue
      // 匿名成員（成員本身是一個定義，358）：定義排在前面，這裡是一格名字為空字串的 fld
      if (m.slots?.members !== undefined) {
        const anon = anonymousMember(m, f)
        if ('miss' in anon) return [anon.miss]
        pre.push(...anon.items)
        fields.push(anon.field)
        continue
      }
      const t = m.slots?.size !== undefined ? ((f.decl(m, false)[0]?.t as CellaJson | undefined) ?? null) : f.type(m.properties?.type, m)
      if (!t) return []
      fields.push(f.k('fld', { name: String(m.properties?.name ?? ''), t }))
    }
    return [...pre, f.k('iUnion', { d: f.k('sdef', { n: n.id, name: unionName(n), fields }) })]
  })
  r.definesUnion('cpp:union_declare', (n) => unionName(n))
  r.definesMacro('cpp:union_declare', (n) => {
    const alias = String(n.properties?.typedef_alias ?? '')
    const tag = String(n.properties?.name ?? '')
    return alias && tag && alias !== tag ? { name: alias, value: `union ${tag}` } : null
  })
}
