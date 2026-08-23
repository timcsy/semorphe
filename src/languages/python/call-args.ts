/**
 * **一個呼叫的引數有幾個**——而這件事有一個陷阱，所以只該有一份。
 *
 * ```python
 * all([x > 0 for x in xs])     arguments 是 argument_list，底下一格
 * all(x > 0 for x in xs)       arguments 【就是】 generator_expression 本身
 * ```
 *
 * 🔴 第二種寫法沒有括號，於是 tree-sitter 把 `arguments` 這個欄位直接指到
 * 產生器上——照 `namedChildren` 去數會數到**兩個**（本體與 `for` 子句），
 * 而那時「引數數量不合就讓路」會把一個完全正常的呼叫踢進通用桶。
 *
 * ⚠️ 症狀不是報錯：`all(x > 0 for x in xs)` **跑得動、印得對**，
 * 只是它在語義樹上叫「一般呼叫」——**身分沒了，而積木也拖不到**。
 * （2026-08-23 由通用桶的逐名報表抓到。）
 */
import type { AstNode } from '../../core/lift/types'

/** 這個呼叫的引數節點們——裸的產生器算**一個**。 */
export function pythonCallArgs(node: AstNode): AstNode[] {
  const argsNode = node.childForFieldName('arguments')
  if (!argsNode) return []
  if (argsNode.type === 'generator_expression') return [argsNode]
  return argsNode.namedChildren
}
