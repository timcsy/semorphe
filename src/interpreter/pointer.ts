/**
 * **「位置」這個東西——實體式指標，也就是迭代器。**
 *
 * ## 🔴 它從哪來（2026-09-17）
 *
 * 語料量到的最大缺口是迭代器（`begin` 33 次、`end` 30 次，而解譯器出錯的
 * 46 支裡約 16 支撞在這一族）。而探索之後的結論是**它不是一個新東西**：
 *
 * ```
 * 符號式指標   &x                  value 是變數名字串，走 pointerTargets
 * 實體式指標   new／malloc／陣列退化  value 是【那串格子本身】，offset 說指到第幾格
 * ```
 *
 * 而容器在執行期就是一串格子（`cpp:loop_range` 直接走 `container.value`），
 * 所以**迭代器 ＝ 實體式指標**。實測八件事裡有六件今天就成立：
 * `*it`、`it + n`、`it - it2`、`it->first`、共用格子、容器退化。
 *
 * 缺的只有兩個動作，而它們**各自壞在一個把值壓成數字的地方**：
 *
 * ```
 * ++p        toNumber(陣列) 回 1 ⟹ 寫回 double 2，指標【當場被毀掉】
 * p != q     兩個指標都變成 1 ⟹ 1 !== 1 ⟹ 恆等於「相等」
 * ```
 *
 * 🔴 而 `toNumber` 對陣列回 1 **是刻意的**（`interpreter.ts` 有註解：少了它，
 * `while (p != NULL)` 對剛配好的節點是假，「整條 Linked List 的走訪一圈都不跑」）。
 * **所以不能改那裡**——要在比較與遞增那一側先問「兩邊都是位置嗎」。
 *
 * > **一個把不同種類的值都壓成同一個數字的函式，
 * > 會讓每一個「拿它們互相比較」的地方同時失效——而每一處看起來都像自己的錯。**
 */
import type { RuntimeValue } from './types'

/**
 * **這是一個「位置」嗎**——實體式指標／迭代器。
 *
 * ⚠️ 判準是 `type === 'array'` ＋ `value` 真的是一串格子。
 *    容器本身也長這樣，而那是**對的**：`v` 退化成指標時就是「指著第 0 格」。
 */
export function isCellPointer(v: RuntimeValue): boolean {
  return v.type === 'array' && Array.isArray(v.value)
}

/**
 * **一串格子被刪過哪幾格**——記在那串格子自己身上，用 Symbol 鍵。
 *
 * ⚠️ 用 Symbol 是為了讓它**不被複製走**：`[...arr.value]`（傳值進函式）
 * 走的是迭代，拿不到 Symbol 鍵——而那是對的，**複本沒有原本的刪除史**。
 */
const ERASURES = Symbol('erasures')
type CellArray = unknown[] & { [ERASURES]?: number[] }

/**
 * **刪掉一格的時候要說一聲。**
 *
 * 🔴 呼叫它的人是「真的把一格抽掉」的那一行（`splice(i, 1)`）。少了它，
 * 別人手上那些位置會安靜地指到隔壁——見 `RuntimeValue.era` 的完整說明。
 */
export function noteErasure(cells: unknown, at: number): void {
  if (!Array.isArray(cells)) return
  const c = cells as CellArray
  ;(c[ERASURES] ??= []).push(at)
}

/** 這串格子到目前為止被刪過幾次——拿一個新位置時要蓋的章。 */
export function erasureCount(cells: unknown): number {
  return Array.isArray(cells) ? ((cells as CellArray)[ERASURES]?.length ?? 0) : 0
}

/**
 * 這個位置指到第幾格。未設 ＝ 0（見 `cpp:address_of`）。
 *
 * 🔴 **而它會把「蓋章之後發生的刪除」補算回來**（2026-09-18）：
 * 每一次刪除的索引都記在**當時**的座標系裡，所以照順序一次修一格，
 * 手上這個 offset 就一路被搬到現在的座標系。
 *
 * ⚠️ 刪掉的正好是自己指的那一格時 **offset 不動**——它自然變成「下一個」，
 *    而那正是 C++ 的 `erase(it)` 回傳的東西。
 */
export function offsetOf(v: RuntimeValue): number {
  let off = v.offset ?? 0
  if (v.era === undefined || !Array.isArray(v.value)) return off
  const log = (v.value as CellArray)[ERASURES]
  if (!log) return off
  for (let i = v.era; i < log.length; i++) if (log[i] < off) off--
  return off
}

/**
 * **蓋章：一個指著這串格子第幾格的位置。**
 *
 * 用它而不是手寫 `{ type: 'array', value, offset }`，否則那個位置**收不到**
 * 之後的刪除通知（未蓋章 ＝ 不修正，見 `RuntimeValue.era`）。
 */
export function positionIn(
  cells: RuntimeValue[],
  offset: number,
  extra: Partial<RuntimeValue> = {},
): RuntimeValue {
  return { ...extra, type: 'array', value: cells, offset, era: erasureCount(cells) }
}

/**
 * **兩個位置指著同一串格子嗎。**
 *
 * ⚠️ 判準是 `===`（同一個 JS 陣列參考），**不是內容相等**：
 * `int a[2]={1,2}, b[2]={1,2};` 的 `&a[0]` 與 `&b[0]` 在 C++ 裡不相等，
 * 而它們的內容一模一樣。
 */
export function sameCells(a: RuntimeValue, b: RuntimeValue): boolean {
  return a.value === b.value
}

/**
 * **把位置往後移幾格**——底下那串格子**不複製**，所以寫回去看得到。
 *
 * ⚠️ **不在這裡檢查越界**：C++ 允許指標指到「尾端之後一格」（那正是 `end()`），
 *    只有**解參考**才是錯的，而 `pointer_deref` 已經在檢查了。
 */
export function movePointer(v: RuntimeValue, delta: number): RuntimeValue {
  // 🔴 **反向的位置，「下一個」是往前**（`rbegin()` 從最後一個往回走）。
  //    少了這一行，`++rit` 往後走——而症狀是**順序安靜地反過來**，不是報錯。
  const step = v.reverse ? -delta : delta
  // ⚠️ `offsetOf` 已經把刪除補算完了，所以**要重新蓋章**——否則同一批刪除
  //    會在下一次讀取時再被補算一次。
  return {
    ...v, type: 'array', value: v.value,
    offset: offsetOf(v) + step, era: erasureCount(v.value),
  }
}
