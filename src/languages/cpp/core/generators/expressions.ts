import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'
// ⚠️ 這裡問的是**性狀**不是身分：括號怎麼加是排版演算法（共用），
// 「我的優先級是 14」是那一顆元件的性質（自己宣告）。
import { precedenceOfNode } from '../node-traits'


/** C++ operator precedence (higher = binds tighter) */
export function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  // 固定的與隨運算子而變的都由元件自己宣告（`node-traits.ts`）。
  return precedenceOfNode(node) ?? 100 // literals, var_ref, etc. — never need parens
}

/** Wrap child expression in parentheses if its precedence is lower than parent's */
export function genChild(child: SemanticNode | undefined, parentPrec: number, ctx: Parameters<NodeGenerator>[1]): string {
  if (!child) return ''
  const expr = generateExpression(child, ctx)
  const childPrec = precedence(child)
  return childPrec < parentPrec ? `(${expr})` : expr
}

export function registerExpressionGenerators(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_ref', (node, _ctx) => {
    return String(node.properties.name ?? '')
  })






























  // ─── Generic container expression concepts ───





  // Expression versions of statement-only blocks (no indent, no semicolons)


  // cpp_scanf_expr moved to std/cstdio/generators.ts




















}
