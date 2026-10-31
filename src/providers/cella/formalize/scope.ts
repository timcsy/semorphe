/**
 * **靜態作用域走訪**——每個變數參照指到宣告它的那個節點（spec 180 FR-003，重構階段 4）。
 *
 * Cella 的程式 JSON 用 `DeclId`（宣告節點的標籤）指名變數，名字只拿來顯示（四之十）。
 * 而今天語義樹的 `var_ref` 只存名字，唯一的名字解析是 JS 直譯器**執行時**的 scope
 * ⟹ formalize 送出之前要自己走一趟。指不到宣告的名字**出聲、不猜**（P6）。
 *
 * 規則照 C++：
 * - 宣告點在宣告子之後（`int x = x;` 的右邊已經是新的 x，C++17 [basic.scope.pdecl]p1）。
 * - 敘述清單（`body`、`then_body`、`else_body`）各開一層；函式的參數與本體同一層。
 * - `for` 的 init、range-for 與計數迴圈的迴圈變數，住在迴圈自己那一層；
 *   range-for 的 `iterable` 與計數迴圈的 `from` 在外層求值。
 *
 * 🔴 **哪一顆開作用域、宣告什麼、參照什麼，由元件自己註冊**（`formalize.ts` 的 `r.scope`，第 389 刀）；
 * 這裡只留通用規則（敘述清單開一層、`obj` 文字屬性、`*_declare` 宣告自己的名字）與走訪本身。
 */
import type { SemanticNode } from '../../../core/types'
import type { ScopeWalker } from '../../../core/formalize-contract'
import { FORMALIZE } from './registry'

export interface ScopeResult {
  /** 參照節點 → 宣告節點。 */
  declOf: Map<string, string>
  /** 指不到宣告的參照（函式庫的常數、還沒宣告就用、打錯字）——由 formalize 決定怎麼辦，這裡不猜。 */
  unresolved: { nodeId: string; name: string }[]
}

/** 會開一層作用域的敘述清單。 */
const BLOCK_SLOTS = new Set(['body', 'then_body', 'else_body'])

function declaredName(n: SemanticNode): string | null {
  const name = n.properties?.name
  if (typeof name !== 'string' || name === '') return null
  if (n.componentId === 'param_decl') return name
  if (n.componentId.endsWith('_declare')) return name
  return null
}

export function resolveScopes(tree: SemanticNode): ScopeResult {
  const declOf = new Map<string, string>()
  const unresolved: ScopeResult['unresolved'] = []
  const stack: Map<string, string>[] = [new Map()]

  const declare = (name: string, nodeId: string): void => { stack[stack.length - 1].set(name, nodeId) }
  const lookup = (name: string): string | undefined => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const hit = stack[i].get(name)
      if (hit) return hit
    }
    return undefined
  }
  const inScope = (f: () => void): void => { stack.push(new Map()); try { f() } finally { stack.pop() } }
  const walkSlot = (n: SemanticNode, slot: string): void => { for (const c of n.slots?.[slot] ?? []) walk(c) }
  const walkSlots = (n: SemanticNode, skip: ReadonlySet<string> = new Set()): void => {
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      if (skip.has(slot)) continue
      if (BLOCK_SLOTS.has(slot)) inScope(() => kids.forEach(walk))
      else kids.forEach(walk)
    }
  }

  const resolve = (refId: string, name: string): void => {
    const hit = lookup(name)
    if (hit) declOf.set(refId, hit)
    else unresolved.push({ nodeId: refId, name })
  }
  const w: ScopeWalker = { walkSlot, walkSlots, inScope, declare, resolve }

  function walk(n: SemanticNode): void {
    const own = FORMALIZE.scope.get(n.componentId)
    if (own) { own(n, w); return }
    // 🔴 方法元件的 `obj` 是**文字**（已知缺口：還沒升格成運算式槽）。單一名字就照常解析，
    //    記在 `<id>#obj`；不是單一名字（`servos[i]`）的照實列進 unresolved，由 formalize 標 unknown。
    const obj = n.properties?.obj
    if (typeof obj === 'string' && obj !== '') {
      const hit = /^[A-Za-z_]\w*$/.test(obj) ? lookup(obj) : undefined
      if (hit) declOf.set(`${n.id}#obj`, hit)
      else unresolved.push({ nodeId: `${n.id}#obj`, name: obj })
    }
    const name = declaredName(n)
    if (name) declare(name, n.id)
    walkSlots(n)
  }

  walk(tree)
  return { declOf, unresolved }
}
