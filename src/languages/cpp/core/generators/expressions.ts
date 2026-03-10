import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'

/** C++ operator precedence (higher = binds tighter) */
function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  switch (node.concept) {
    case 'cpp_comma_expr': return 1
    case 'var_assign': return 2
    case 'cpp_compound_assign_expr': return 2
    case 'cpp_ternary': return 3
    case 'logic': {
      const op = node.properties.operator
      return op === '||' ? 4 : 5 // || = 4, && = 5
    }
    case 'compare': {
      const op = node.properties.operator
      return (op === '==' || op === '!=') ? 8 : 9 // == != = 8, < > <= >= = 9
    }
    case 'arithmetic': {
      const op = node.properties.operator
      return (op === '+' || op === '-') ? 11 : 12 // + - = 11, * / % = 12
    }
    case 'negate':
    case 'logic_not':
    case 'bitwise_not':
    case 'cpp_address_of':
    case 'cpp_pointer_deref':
    case 'cpp_cast':
      return 14 // unary prefix
    case 'cpp_increment_expr': return 15
    case 'func_call_expr':
    case 'array_access':
      return 16
    default: return 100 // literals, var_ref, etc. — never need parens
  }
}

/** Wrap child expression in parentheses if its precedence is lower than parent's */
function genChild(child: SemanticNode | undefined, parentPrec: number, ctx: Parameters<NodeGenerator>[1]): string {
  if (!child) return ''
  const expr = generateExpression(child, ctx)
  const childPrec = precedence(child)
  return childPrec < parentPrec ? `(${expr})` : expr
}

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

  g.set('compare', (node, ctx) => {
    const prec = precedence(node)
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec, ctx)
    const op = node.properties.operator ?? '=='
    return `${left} ${op} ${right}`
  })

  g.set('logic', (node, ctx) => {
    const prec = precedence(node)
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec + 1, ctx)
    const op = node.properties.operator ?? '&&'
    return `${left} ${op} ${right}`
  })

  g.set('logic_not', (node, ctx) => {
    const operand = genChild((node.children.operand ?? [])[0], precedence(node), ctx)
    return `!${operand}`
  })

  g.set('negate', (node, ctx) => {
    const op = (node.properties.operator as string) ?? '-'
    const val = genChild((node.children.value ?? node.children.operand ?? [])[0], precedence(node), ctx)
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

  // cpp_scanf_expr moved to std/cstdio/generators.ts

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
