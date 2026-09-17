/**
 * 建構子——**讓重組括號的那個人不必寫下這顆的身分**。
 *
 * 🔴 為什麼需要它（2026-09-18）：tree-sitter 把 `c ? a : b = d` 剖成
 * `(c ? a : b) = d`，而 C++ 說三元的第三個運算元是**指定式**。重組那件事
 * 住在指定那一路的共用檔（判別是文法的知識），而**產出的身分是這顆的**。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildTernary(
  condition: SemanticNode, trueExpr: SemanticNode, falseExpr: SemanticNode,
): SemanticNode {
  return createNode('cpp:ternary', {}, {
    condition: [condition], true_expr: [trueExpr], false_expr: [falseExpr],
  })
}
