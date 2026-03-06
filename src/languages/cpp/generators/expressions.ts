import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerExpressionGenerators(g: Map<string, NodeGenerator>): void {
  g.set('var_ref', (node, _ctx) => {
    return String(node.properties.name ?? '')
  })

  g.set('number_literal', (node, _ctx) => {
    return String(node.properties.value ?? '0')
  })

  g.set('string_literal', (node, _ctx) => {
    return `"${node.properties.value ?? ''}"`
  })

  g.set('arithmetic', (node, ctx) => {
    const left = generateExpression((node.children.left ?? [])[0], ctx)
    const right = generateExpression((node.children.right ?? [])[0], ctx)
    const op = node.properties.operator ?? '+'
    return `${left} ${op} ${right}`
  })

  g.set('compare', (node, ctx) => {
    const left = generateExpression((node.children.left ?? [])[0], ctx)
    const right = generateExpression((node.children.right ?? [])[0], ctx)
    const op = node.properties.operator ?? '=='
    return `${left} ${op} ${right}`
  })

  g.set('logic', (node, ctx) => {
    const left = generateExpression((node.children.left ?? [])[0], ctx)
    const right = generateExpression((node.children.right ?? [])[0], ctx)
    const op = node.properties.operator ?? '&&'
    return `${left} ${op} ${right}`
  })

  g.set('logic_not', (node, ctx) => {
    const operand = generateExpression((node.children.operand ?? [])[0], ctx)
    return `!${operand}`
  })

  g.set('negate', (node, ctx) => {
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `-${val}`
  })

  g.set('func_call_expr', (node, ctx) => {
    const name = node.properties.name ?? 'f'
    const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
    return `${name}(${args.join(', ')})`
  })
}
