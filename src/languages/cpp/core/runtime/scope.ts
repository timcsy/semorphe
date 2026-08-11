/**
 * **變數作用域的執行期輔助** —— 一個與身分無關的演算法
 *
 * ⚠️ 這個檔原本叫「variables 的語言專屬執行路——10 個」，而那 10 個
 * **全部搬進膠囊了**。留下一個空的註冊函式就是殼，所以刪掉，
 * 只留 `根作用域` ——它是 `var_declare_static` 用的，不屬於任何一顆的五路。
 *
 * > **共用的是演算法，不是身分。**
 */
import type { Scope } from '../../../../interpreter/scope'

/** 走到最外層的作用域——區域靜態變數的儲存位置（它比函式活得久） */
export function 根作用域(s: Scope): Scope {
  let cur = s
  while (cur.parent) cur = cur.parent
  return cur
}

