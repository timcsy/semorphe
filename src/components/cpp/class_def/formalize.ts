/**
 * `cpp:class_def` 的 **formalize** 路（spec 203）——`class A : public B { public: … private: … };` → `iClass (cdef … isClass=true)`。
 * 形狀照 Cella 的 `cfamily.syntax`（`cdef n name isClass bases members`）與 `tools/cfamily/cpp_to_tree.py` 的 `record`。契約見 `core/formalize-contract.ts`。
 *
 * - 語義樹把成員分在 `public`／`protected`／`private` 三個槽——每一節的存取權寫進那一節每個成員的 `acc`。
 *   ⚠️ 原始碼裡各節交錯的順序（`public: … private: … public: …`）在語義樹裡已經合併成三個槽（lift 的形狀，不是這裡的取捨）。
 * - 欄位（有 `type`、不是自己會翻成成員的那幾顆）→ `mbField`，預設初值（`int v = 7;`）放 `init`。
 * - 其餘成員（成員函式、建構子、解構子、靜態成員、運算子多載）由那顆元件自己翻（`f.member`），這裡只蓋上那一節的存取權。
 */
import { effectiveAccess } from '../../../languages/cpp/base-clause'
import type { CellaJson, FormalizeContext, FormalizeRegistrar } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

const SECTIONS = [['public', 'acPublic'], ['protected', 'acProtected'], ['private', 'acPrivate']] as const

/** 一節裡的成員：`int x, y;` 是一顆 `_multi_field` 包著平行的宣告——攤平（同 struct_declare） */
const membersOf = (n: SemanticNode, slot: string): SemanticNode[] =>
  (n.slots?.[slot] ?? []).flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
/** 自己翻成成員的那幾顆：沒有型別的（函式類）與靜態成員（它有型別，但不是每個物件各一份的欄位） */
const ownMember = (m: SemanticNode, f: FormalizeContext): boolean => m.properties?.type === undefined || f.ownsMember(m)

function member(m: SemanticNode, f: FormalizeContext, acc: string): CellaJson | null {
  if (ownMember(m, f)) {
    const x = f.member(m)
    return x && 'acc' in x ? { ...x, acc: f.k(acc) } : x
  }
  // 陣列欄位（`int a[5];`——有長度槽）：型別取它自己的宣告翻出來的那一個（tArr／tArrE），不是元素型別（元件管線 322）
  const t = m.slots?.size !== undefined ? ((f.decl(m, false)[0]?.t as CellaJson | undefined) ?? null) : f.type(m.properties?.type, m)
  if (!t) return null
  const initNode = f.one(m, 'initializer')
  return f.k('mbField', { acc: f.k(acc), name: String(m.properties?.name ?? ''), t, init: initNode ? f.expr(initNode) : null })
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:class_def', (n, f) => {
    if (f.options.isC) return [f.miss(n, 'C 沒有 class')]
    const members: CellaJson[] = []
    for (const [slot, acc] of SECTIONS) {
      for (const m of membersOf(n, slot)) {
        if (/:(comment|block_comment)$/.test(m.componentId)) continue
        const x = member(m, f, acc)
        if (x) members.push(x)
      }
    }
    const baseName = String(n.properties?.base_class ?? '').trim()
    const baseAcc = ({ public: 'acPublic', protected: 'acProtected', private: 'acPrivate' } as const)[effectiveAccess(String(n.properties?.base_access ?? 'public'), true)]   // implicit ＝ class 的 private（spec 209）
    const bases = baseName ? [f.k('base', { acc: f.k(baseAcc), virt: false, name: baseName })] : []
    return [f.k('iClass', { d: f.k('cdef', { n: n.id, name: String(n.properties?.name ?? ''), isClass: true, bases, members }) })]
  })
  r.definesType('cpp:class_def', (n) => String(n.properties?.name ?? ''))
  // 作用域：類別本體是一層；成員函式的本體是「完整類別的語境」——寫在後面的欄位也看得到（[class.mem]p6），所以欄位先宣告再走
  r.scope('cpp:class_def', (n, w) => w.inScope(() => {
    for (const [slot] of SECTIONS) {
      for (const m of membersOf(n, slot)) {
        if (m.properties?.type !== undefined && typeof m.properties?.name === 'string') w.declare(m.properties.name, m.id)
      }
    }
    for (const [slot] of SECTIONS) w.walkSlot(n, slot)
  }))
}
