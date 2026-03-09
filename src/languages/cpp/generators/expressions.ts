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

  g.set('builtin_constant', (node, _ctx) => {
    return String(node.properties.value ?? 'NULL')
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
    const op = (node.properties.operator as string) ?? '-'
    const val = generateExpression((node.children.value ?? node.children.operand ?? [])[0], ctx)
    return `${op}${val}`
  })

  g.set('func_call_expr', (node, ctx) => {
    const name = node.properties.name ?? 'f'
    const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
    return `${name}(${args.join(', ')})`
  })

  g.set('cpp_ternary', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const trueExpr = generateExpression((node.children.true_expr ?? [])[0], ctx)
    const falseExpr = generateExpression((node.children.false_expr ?? [])[0], ctx)
    return `${cond} ? ${trueExpr} : ${falseExpr}`
  })

  g.set('cpp_cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `(${targetType})${val}`
  })

  g.set('bitwise_not', (node, ctx) => {
    const operand = generateExpression((node.children.operand ?? [])[0], ctx)
    return `~${operand}`
  })

  g.set('cpp_address_of', (node, ctx) => {
    const v = generateExpression((node.children.var ?? [])[0], ctx)
    return `&${v}`
  })

  g.set('cpp_pointer_deref', (node, ctx) => {
    const ptr = generateExpression((node.children.ptr ?? [])[0], ctx)
    return `*${ptr}`
  })

  g.set('cpp_comma_expr', (node, ctx) => {
    const exprs = (node.children.exprs ?? []).map(e => generateExpression(e, ctx))
    return exprs.join(', ')
  })

  // Expression versions of statement-only blocks (no indent, no semicolons)
  g.set('cpp_increment_expr', (node) => {
    const name = (node.properties.name ?? node.properties.NAME ?? 'i') as string
    const op = (node.properties.operator ?? node.properties.OP ?? '++') as string
    const pos = (node.properties.position ?? node.properties.POSITION ?? 'postfix') as string
    if (pos === 'prefix') return `${op}${name}`
    return `${name}${op}`
  })

  g.set('cpp_compound_assign_expr', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const op = node.properties.operator ?? '+='
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${name} ${op} ${val}`
    }
    return `${name} ${op} 0`
  })

  g.set('cpp_scanf_expr', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => {
        const expr = generateExpression(a, ctx)
        if (a.concept === 'var_ref' && !a.properties.noAddr) return `&${expr}`
        return expr
      })
      return `scanf("${format}", ${args.join(', ')})`
    }
    const argsText = (node.properties.args as string) ?? ''
    return `scanf("${format}"${argsText})`
  })

  g.set('var_declare_expr', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${type} ${name} = ${val}`
    }
    return `${type} ${name}`
  })
}
