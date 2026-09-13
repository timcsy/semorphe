/**
 * **一個子節點放得進這一格嗎**——`slots` 那份宣告的唯一判定處。
 *
 * ## 🔴 它為什麼存在：宣告了六年而只有一個消費者
 *
 * `component.json` 的 `slots` 一直寫著兩件事，而（2026-09-14 量到）：
 *
 * ```
 * allowed   332 顆都有        只有【流程接線】一處在讀
 * min/max   41 個槽宣告了     读者【0】——`slotsOf` 連回傳都沒回傳它
 * ```
 *
 * 注入量到的症狀：
 *
 * ```
 * 違反 min/max 的樹   產碼安靜 58/60 · 積木安靜 60/60
 * 把語句塞進只收運算式的格子   218 個格子，產碼與積木【全部】安靜
 * ```
 *
 * 而 `max` 那一族的症狀特別壞：**多出來的子節點不是報錯，是消失**
 * ——學生接了兩顆積木，產出的程式碼只用了一顆。
 *
 * > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
 * > （`traits.ts` 的檔頭 2026-08-26 就記過這句，而它只兌現了一次。）
 *
 * ## ⚠️ 它是【報告】，不是閘門
 *
 * 這個產品的核心承諾是「認不出來的語法不會被丟掉，也不會被猜」。
 * 一個會**拒絕**的檢查器與那條承諾直接衝突，而且這棵樹多數時候是
 * **部分已知**的（降級節點就在裡面）。
 *
 * 🟢 所以形狀是**漸進式**的：降級節點是動態型別（`?`），它與任何宣告相容，
 * 檢查只發生在**兩端都已知**的接縫上。這與型別論裡的 gradual typing
 * 是同一個設計——兩邊各自發明過一次。
 *
 * ## 兩條軸不是同一條
 *
 * ```
 * role       產生器契約   「我自己收尾嗎」        → asStatement／asExpression 讀它
 * positions  文法位置     「我出現在這裡合法嗎」  → 這一支讀它
 * ```
 *
 * 混用的症狀已經量過：`for (int i = 0; i < n; i++)` 在流程面板上**組不出來**
 * （7 個真實世界合法的接法，7 個全被拒絕）。見 `traits.ts` 的 `positionsOf`。
 */
import { registeredComponents } from './registry'
import { componentTraits, usableAsExpression, usableAsStatement } from './traits'
import { nonComponentDecl } from '../blocks/non-components'
import type { SemanticNode } from '../types'

/** 一個槽的宣告，**含多重度**——`slotsOf` 刻意不回傳 `min`／`max`，所以這裡自己讀。 */
export interface SlotDecl {
  slot: string
  allowed: string[]
  min?: number
  max?: number
}

export type SlotFindingKind = 'min' | 'max' | 'allowed'

export interface SlotFinding {
  /** 出問題的那個**父節點**——真實那一側的 id */
  nodeId?: string
  componentId: string
  slot: string
  kind: SlotFindingKind
  /**
   * 措辭要用的**結構化欄位**——⚠️ **不是一句中文**。
   *
   * 🔴 這裡放中文字串的話，兩個面板就只能說同一句話，而
   * `Diagnostic.rule` 那一刀（2026-08-14）正是為了拆開它們：
   * 程式碼側要像編譯器，積木側可以不一樣。
   */
  params: Record<string, string | number>
}

/**
 * 這顆是**降級／結構節點**嗎——也就是型別論裡的 `?`。
 *
 * 🔴 **它與任何宣告相容，而那不是寬鬆，是誠實**：一顆灰積木的內容
 * 我們根本沒有讀懂，所以我們**不知道**它合不合法。
 * 把「不知道」報成「違反」，會讓每一個貼進真實程式碼的人看到一片紅。
 *
 * > **把「我不知道」算成「你錯了」的檢查器，
 * > 量的是它自己的辨識率，不是使用者的程式。**
 */
export function isDynamic(componentId: string): boolean {
  if (nonComponentDecl(componentId) !== undefined) return true
  const bare = componentId.split(':').pop() ?? componentId
  return bare === 'raw_code' || bare === 'raw_expression' || bare === 'unresolved'
}

/** 這顆元件宣告的全部子槽——**含 `min`／`max`**。 */
export function slotDeclsOf(componentId: string): SlotDecl[] {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  const slots = (c?.manifest as { slots?: Record<string, unknown> } | undefined)?.slots
  if (!slots) return []
  return Object.entries(slots).map(([slot, v]) => {
    if (typeof v === 'string') return { slot, allowed: [v] }
    const o = (v ?? {}) as { allowed?: unknown[]; min?: number; max?: number }
    return {
      slot,
      allowed: Array.isArray(o.allowed) ? o.allowed.map(String) : [],
      min: typeof o.min === 'number' ? o.min : undefined,
      max: typeof o.max === 'number' ? o.max : undefined,
    }
  })
}

const isKindWord = (a: string): boolean =>
  a === 'expression' || a === 'expressions' || a === 'statement' || a === 'statements'

/**
 * `componentId` 放得進一個 `allowed` 這樣宣告的格子嗎。
 *
 * 判定是**聯集**：種類（`expression`／`statement`）∪ 具名身分 ∪ 族（trait）。
 * ⚠️ 「有具名就不看種類」是錯的——那判的是優先序，不是聯集。
 */
export function fitsSlot(componentId: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  if (isDynamic(componentId)) return true          // ← 動態型別，與一切相容
  for (const a of allowed) {
    if (a === componentId || a === componentId.split(':').pop()) return true
    if (isKindWord(a)) {
      const wantExpr = a === 'expression' || a === 'expressions'
      if (wantExpr) {
        if (usableAsExpression(componentId)) return true
        continue
      }
      // ⚠️ **要語句的格子，只收宣告得出「我也是語句」的**。
      //
      // 🔴 第一版寫成「運算式一律收」，理由是 `f(x);` 是合法的 C++——
      //    而那讓 `cpp:literal_number` 也接得進迴圈身體（`0;`）。
      //    技術上合法，教學上是一顆掉在那裡的積木。
      //
      // > **「文法允許」與「這一格該收」不是同一個問題。
      // > 前者是語言的事，後者是這個工具要不要讓學生做那件事。**
      //
      // 🟢 所以 `f(x)` 那一類要**自己宣告**（`cpp:func_call` 的 `positions`
      //    帶著 `statement`）——一顆一顆講得出理由，而不是整族放行。
      if (usableAsStatement(componentId)) return true
      continue
    }
    if (componentTraits(componentId)?.[a] === true) return true
  }
  return false
}

/**
 * 走過整棵樹，回報每一處**違反自己宣告**的地方。
 *
 * ⚠️ **一個宣告不完整的父節點不算違反**——它的宣告讀不到（元件沒登錄、
 * 或是結構節點），那是「不知道」不是「錯」。
 */
export function checkSlots(tree: SemanticNode): SlotFinding[] {
  const out: SlotFinding[] = []
  const walk = (n: SemanticNode): void => {
    if (!isDynamic(n.componentId)) {
      for (const d of slotDeclsOf(n.componentId)) {
        const kids = ((n.slots ?? {}) as Record<string, SemanticNode[]>)[d.slot] ?? []
        if (d.min !== undefined && kids.length < d.min) {
          out.push({
            nodeId: n.id, componentId: n.componentId, slot: d.slot, kind: 'min',
            params: { slot: d.slot, min: d.min, got: kids.length },
          })
        }
        if (d.max !== undefined && kids.length > d.max) {
          out.push({
            nodeId: n.id, componentId: n.componentId, slot: d.slot, kind: 'max',
            // 🔴 這一條的症狀是【多的那幾顆會消失】，不是報錯
            params: { slot: d.slot, max: d.max, got: kids.length },
          })
        }
        for (const k of kids) {
          if (!fitsSlot(k.componentId, d.allowed)) {
            out.push({
              nodeId: n.id, componentId: n.componentId, slot: d.slot, kind: 'allowed',
              params: { slot: d.slot, got: k.componentId, want: d.allowed.join(' / ') },
            })
          }
        }
      }
    }
    for (const bucket of Object.values((n.slots ?? {}) as Record<string, SemanticNode[]>)) {
      for (const c of bucket ?? []) walk(c)
    }
  }
  walk(tree)
  return out
}
