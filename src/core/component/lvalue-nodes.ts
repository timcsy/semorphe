/**
 * 「哪些節點可以被**寫回**」的登記處——核心給機制，元件給資料。
 *
 * ## 為什麼需要它
 *
 * `swap(a[j], a[j+1])` 要把兩個位置的值對調，而 `ctx.evaluate` 給的是**值**
 * ——寫回需要知道「這個節點指的是哪一格」。
 *
 * 而「`cpp:array_at` 是一個下標存取」是 C++ 的知識。寫進核心的話，
 * 那顆元件就永遠搬不動（就近性護欄會指名）；寫進共用檔也一樣。
 *
 * > **問角色，不問身分。**（`memberRoleOf`／`isAggregateList` 同一條）
 *
 * ⚠️ 這張表是**空的**，每顆 lvalue 元件在自己的 `lift.ts` 宣告自己的角色。
 */

/** 一個可寫回的節點是哪一種形狀 */
export type LvalueKind =
  /** 一個名字（`x`）——寫回作用域 */
  | 'name'
  /** 容器的一格（`a[i]`）——接點 `obj`／`index` 給出容器與索引 */
  | 'element'
  /** 物件的一個欄位（`p.x`）——屬性 `obj`／`member` */
  | 'field'

const lvalues = new Map<string, LvalueKind>()

/** 元件宣告：「我這種節點可以被寫回，形狀是這種」。 */
export function declareLvalue(componentId: string, kind: LvalueKind): void {
  lvalues.set(componentId, kind)
}

/** 這個節點可以被寫回嗎？沒有人宣告過就是 `undefined`——不猜。 */
export function lvalueKindOf(componentId: string): LvalueKind | undefined {
  return lvalues.get(componentId)
}

/** 護欄用：誰宣告過。 */
export function declaredLvalues(): [string, LvalueKind][] {
  return [...lvalues.entries()]
}
