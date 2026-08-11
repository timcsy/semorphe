/**
 * `cpp:ifdef` 的 **lift** 路——**一筆資料：「`#ifdef` 這個指令屬於我」**
 *
 * 原本是一個三元運算子裡的字串
 * （`startsWith('#ifndef') ? 'cpp:ifndef' : 'cpp:ifdef'`）。
 * 與 `var_declare_const`／`constexpr` 同一個形狀，所以共用同一張登錄表
 * ——**「關鍵字 → 身分」是一種形狀，不是一個特例。**
 */
import { registerQualifierConcept } from '../../../core/component/qualifier-concepts'

export function registerLift(): void {
  registerQualifierConcept('ifdef', 'cpp:ifdef', 'cpp/ifdef')
}
