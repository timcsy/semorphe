/**
 * `cpp:var_declare_const` 的 **lift** 路——**一筆資料：「`const` 這個修飾詞屬於我」**
 *
 * 它原本連 `createNode` 都沒有——只是一個三元運算子裡的字串：
 *
 * ```ts
 * const componentId = qualifier === 'const' ? 'cpp:var_declare_const'
 *                                         : 'cpp:var_declare_constexpr'
 * ```
 *
 * > **一顆元件可以只以「一個三元運算子的其中一支」存在。**
 * > 那種形式連掃描器都看得到，而**它不會出現在任何「建立點」的統計裡**
 * > ——因為它不是建立，是選名字。
 */
import { registerQualifierConcept } from '../../../core/component/qualifier-concepts'

export function registerLift(): void {
  registerQualifierConcept('const', 'cpp:var_declare_const', 'cpp/var_declare_const')
}
