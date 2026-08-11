import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'
// ⚠️ 這裡問的是**性狀**不是身分：括號怎麼加是排版演算法（共用），
// 「我的優先級是 14」是那一顆元件的性質（自己宣告）。
import { precedenceOf } from '../node-traits'

/** Operator-dependent precedence for concepts with varying operators. */
const OPERATOR_PRECEDENCE: Record<string, (op: unknown) => number> = {
  'cpp:logic': (op) => op === '||' ? 4 : 5,
  'cpp:compare': (op) => (op === '==' || op === '!=') ? 8 : 9,
  'cpp:arithmetic': (op) => (op === '+' || op === '-') ? 11 : 12,
}

/** C++ operator precedence (higher = binds tighter) */
export function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  const fixed = precedenceOf(node.conceptId)
  if (fixed !== undefined) return fixed
  const opFn = OPERATOR_PRECEDENCE[node.conceptId]
  if (opFn) return opFn(node.properties.operator)
  return 100 // literals, var_ref, etc. — never need parens
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

  g.set('cpp:literal_number', (node, _ctx) => {
    return String(node.properties.value ?? '0')
  })

  g.set('cpp:literal_string', (node, _ctx) => {
    return `"${node.properties.value ?? ''}"`
  })



  g.set('cpp:arithmetic', (node, ctx) => {
    const op = node.properties.operator ?? '+'
    const prec = precedence(node)
    const leftNode = (node.children.left ?? [])[0]
    const rightNode = (node.children.right ?? [])[0]
    const left = genChild(leftNode, prec, ctx)
    // Right child: use prec+1 to force parens for same-precedence on right side
    // e.g. a - (b - c) needs parens, but a - b + c doesn't (left-to-right)
    const right = genChild(rightNode, prec + 1, ctx)
    return `${left} ${op} ${right}`
  })

  g.set('cpp:compare', (node, ctx) => {
    const prec = precedence(node)
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec, ctx)
    const op = node.properties.operator ?? '=='
    return `${left} ${op} ${right}`
  })

  g.set('cpp:logic', (node, ctx) => {
    const prec = precedence(node)
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec + 1, ctx)
    const op = node.properties.operator ?? '&&'
    return `${left} ${op} ${right}`
  })


















  // ─── Generic container expression concepts ───





  // Expression versions of statement-only blocks (no indent, no semicolons)


  // cpp_scanf_expr moved to std/cstdio/generators.ts




















}
