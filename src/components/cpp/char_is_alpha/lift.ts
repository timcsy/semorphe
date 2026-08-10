/**
 * `cpp:char_is_alpha` 的 **lift** 路
 *
 * ⚠️ **這一路搬進來的不是函式，是一筆資料**——與第一顆膠囊同一個形狀。
 *
 * 它原本是 `lifters/io.ts` 裡一張分派表中的一列：
 *
 * ```ts
 * const cctypeFuncs = { 'isalpha': 'cpp:char_is_alpha', … }
 * ```
 *
 * 判別邏輯（找 `call_expression`、取第一個引數）本來就是共用的，留在原處是對的；
 * 要回家的是「**`isalpha` 這個名字屬於我**」這個宣告。
 *
 * ## 這一顆證明了什麼
 *
 * `specs/104` 的形狀分類把 `io.ts` 那 **68 顆**列為「處方尚未實測」的一批
 * （相對於 `strategies.ts` 那 41 顆已驗證）。**實測結果：兩批是同一種形狀。**
 * 那 109 顆的估計因此可以合併。
 */
import { registerSingleArgFunction } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerSingleArgFunction('isalpha', 'cpp:char_is_alpha', 'cpp/char_is_alpha')
}
