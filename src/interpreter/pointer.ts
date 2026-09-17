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

/** 這個位置指到第幾格。未設 ＝ 0（見 `cpp:address_of`）。 */
export function offsetOf(v: RuntimeValue): number {
  return v.offset ?? 0
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
  return { ...v, type: 'array', value: v.value, offset: offsetOf(v) + step }
}
