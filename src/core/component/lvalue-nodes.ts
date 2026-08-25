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
 * ## 🔴 2026-08-25：從「三個 kind」換成「一個函式」
 *
 * 第一版登記的是 `LvalueKind = 'name' | 'element' | 'field'`，而**那仍然是列舉式**：
 *
 * ```
 * 列舉式   'name' | 'element' | 'field'        → *q、a.b.c、d["k"] 各要一個新的 kind
 * 扣除式   一顆節點交出「怎麼讀、怎麼寫」        → 沒有下一個
 * ```
 *
 * 而 `'field'` 那一種**讀的是 `node.properties.obj`（一個字串）**
 * ——所以 `o.x.y` 在第一版裡解不出來：接收者被壓成了字串。
 *
 * 換成函式之後，一顆節點的接收者可以是**另一個節點**，於是巢狀自然成立。
 * 見 `knowledge/concepts/左值.md`。
 *
 * ⚠️ 這張表是**空的**，每顆 lvalue 元件在自己的膠囊裡宣告自己怎麼解。
 */
import type { SemanticNode } from '../types'

/**
 * 一個解出來的位置：讀得到也寫得回。
 *
 * 🔴 **讀寫都是同步的**——解析（找到那一格）可以是非同步的（索引要求值），
 * 而**一旦解出來，讀與寫必須不再求值**：`swap(a[i], a[j])` 若在寫回時
 * 重新求一次索引，中途被改掉的 `i` 會讓它寫到別格。
 */
export interface Place {
  read(): unknown
  write(v: unknown): void
}

/**
 * 怎麼把這一種節點解成一個位置。
 *
 * ⚠️ `ctx` 刻意是 `unknown`——**核心的登記處不該認得直譯器的型別**
 * （那會讓 `core/component` 依賴 `interpreter`）。呼叫端在
 * `interpreter/lvalue.ts` 收窄回 `ExecutionContext`。
 */
export type PlaceResolver = (node: SemanticNode, ctx: never) => Promise<Place>

const lvalues = new Map<string, PlaceResolver>()

/** 元件宣告：「我這種節點可以被寫回，而這是怎麼解它」。 */
export function declareLvalue(componentId: string, resolve: PlaceResolver): void {
  lvalues.set(componentId, resolve)
}

/** 這個節點可以被寫回嗎？沒有人宣告過就是 `undefined`——**不猜**。 */
export function lvalueResolverOf(componentId: string): PlaceResolver | undefined {
  return lvalues.get(componentId)
}

/** 護欄用：誰宣告過。 */
export function declaredLvalues(): string[] {
  return [...lvalues.keys()]
}
