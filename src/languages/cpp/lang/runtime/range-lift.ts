/**
 * **範圍的兩端，lift 與 generate 兩側共用的組裝**（2026-09-18）。
 *
 * 十顆範圍演算法在這件事上一個字都不差：第一個引數是開頭、第二個是結尾，
 * 兩個都是**運算式**。把它寫十遍的話，下一次要改（例如接不出來時怎麼讓開）
 * 就得改十處，而**漏掉的那一處不會有人發現**。
 *
 * ⚠️ **這裡沒有任何元件身分**——它組裝的是「兩個接點」，不是「誰的接點」。
 *    要組裝別顆元件的節點時得在那顆膠囊裡放 `build.ts`（就近性護欄兩個方向都報）。
 */
import type { SemanticNode } from '../../../../core/types'

interface AstLike { }

/**
 * 把前兩個引數 lift 成 `{ begin, end }`。
 *
 * ⚠️ **接不出來就回 `null`**（呼叫者據此讓開）——猜一個錯的專屬身分
 *    比誠實降級更糟，而降級是看得見的。
 */
export function liftRangeEnds(
  argChildren: readonly AstLike[],
  ctx: { lift(n: AstLike): SemanticNode | null },
): { begin: SemanticNode[]; end: SemanticNode[] } | null {
  const begin = argChildren[0] ? ctx.lift(argChildren[0]) : null
  const end = argChildren[1] ? ctx.lift(argChildren[1]) : null
  if (!begin || !end) return null
  return { begin: [begin], end: [end] }
}

/**
 * 產碼那一側：把兩個接點變回兩段原始碼。
 *
 * ⚠️ **沒接上時產出一個看得懂的預設**——產碼不該丟錯（那會讓整份程式碼消失），
 *    而 `v.begin()`／`v.end()` 是這一族最常見的形狀，學生一眼看得出要補什麼。
 */
export function rangeEndsCode(
  node: SemanticNode,
  ctx: unknown,
  gen: (n: SemanticNode, c: never) => string,
): [string, string] {
  const b = (node.slots.begin ?? [])[0]
  const e = (node.slots.end ?? [])[0]
  return [
    b ? gen(b, ctx as never) : 'v.begin()',
    e ? gen(e, ctx as never) : 'v.end()',
  ]
}
