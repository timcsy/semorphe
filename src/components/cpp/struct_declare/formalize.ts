/** `cpp:struct_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import { effectiveAccess } from '../../../languages/cpp/base-clause'
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'
import { anonymousMember } from '../union_declare/formalize'

/** 單一基底（spec 209）；implicit ＝ struct 的 public */
function basesOf(n: Parameters<Parameters<FormalizeRegistrar['item']>[1]>[0], f: Parameters<Parameters<FormalizeRegistrar['item']>[1]>[1], isClass: boolean): CellaJson[] {
  const name = String(n.properties?.base_class ?? '').trim()
  if (!name) return []
  const acc = ({ public: 'acPublic', protected: 'acProtected', private: 'acPrivate' } as const)[effectiveAccess(String(n.properties?.base_access ?? 'implicit'), isClass)]
  return [f.k('base', { acc: f.k(acc), virt: false, name })]
}

/** struct 在 Cella 那邊的名字：有 Tag 用 Tag，匿名的 `typedef struct { … } Point;` 用別名（2026-11-08） */
function structName(n: Parameters<Parameters<FormalizeRegistrar['item']>[1]>[0]): string {
  // 沒有標籤也沒有另名（結構裡的匿名成員）：合成的名字（Cella 0959，358）
  return String(n.properties?.name ?? '') || String(n.properties?.typedef_alias ?? '') || `(unnamed struct at ${n.id})`
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:struct_declare', (n, f) => {
    const fields: CellaJson[] = []
    const methods: CellaJson[] = []
    // `int x, y;` 在 lift 成一顆 `_multi_field`、裡面是平行的宣告（產碼那一路也是攤平，見 generators/declarations.ts）⟹ 這裡同樣攤平（第 213 刀）
    const members = (n.slots?.members ?? []).flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
    const pre: CellaJson[] = []
    for (const m of members) {
      // 成員之間的註解不是成員（spec 199）
      if (/:(comment|block_comment)$/.test(m.componentId)) continue
      // 匿名成員（成員本身是一個定義，358）：定義排在前面，這裡是一格名字為空字串的 fld（只有 C）
      if (m.slots?.members !== undefined) {
        const anon = anonymousMember(m, f)
        if ('miss' in anon) return [anon.miss]
        pre.push(...anon.items)
        fields.push(anon.field)   // 只有 C 走得到這裡；下面轉 fld 時照樣取 name／t
        continue
      }
      // 沒有型別的是成員函式（含運算子多載）：由那顆元件自己翻成 mbMethod（spec 201）；靜態成員有型別但不是欄位，同樣自己翻（spec 203）
      if (m.properties?.type === undefined || f.ownsMember(m)) { const x = f.member(m); if (x) methods.push(x); continue }
      // 陣列欄位（有長度槽；二維的有 rows 槽，第 400 刀）：型別取它自己的宣告翻出來的那一個（tArr），不是元素型別（元件管線 322，同類別那顆）
      const t = m.slots?.size !== undefined || m.slots?.rows !== undefined ? ((f.decl(m, false)[0]?.t as CellaJson | undefined) ?? null) : f.type(m.properties?.type, m)
      // 預設成員初值（`struct P { int x = 3; };`，C++11 [class.mem]p10）放 init（spec 203：在此之前一律送 null，Cella 判讀到未初始化的值）
      const initNode = f.options.isC ? undefined : f.one(m, 'initializer')
      if (t) fields.push(f.k('mbField', { acc: f.k('acPublic'), name: String(m.properties?.name ?? ''), t, init: initNode ? f.expr(initNode) : null }))
    }
    if (f.options.isC && methods.length > 0) return [f.miss(n, 'C 的 struct 沒有成員函式')]
    if (f.options.isC) {
      const cFields = fields.map((x) => f.k('fld', { name: x.name, t: x.t }))
      return [...pre, f.k('iStruct', { d: f.k('sdef', { n: n.id, name: structName(n), fields: cFields }) })]
    }
    return [f.k('iClass', { d: f.k('cdef', { n: n.id, name: structName(n), isClass: false, bases: basesOf(n, f, false), members: [...fields, ...methods] }) })]
  })
  // 定義了一個型別名：不帶關鍵字的 `Node*` 要先認得 `Node`
  r.definesType('cpp:struct_declare', (n) => structName(n))
  // `typedef struct node_s { … } Node;`：Tag 與別名不同 ⟹ 別名照 typedef 那一族記（`Node` 展開成 `node_s`）
  r.definesMacro('cpp:struct_declare', (n) => {
    const alias = String(n.properties?.typedef_alias ?? '')
    const tag = String(n.properties?.name ?? '')
    return alias && tag && alias !== tag ? { name: alias, value: tag } : null
  })
}
