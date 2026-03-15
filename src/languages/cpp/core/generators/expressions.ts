import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression, generateBody, indented, indent } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'

/** C++ operator precedence data (higher = binds tighter). */
const PRECEDENCE_MAP = new Map<string, number>([
  ['cpp_comma_expr', 1],
  ['var_assign', 2],
  ['cpp_compound_assign_expr', 2],
  ['cpp_ternary', 3],
  ['negate', 14],
  ['logic_not', 14],
  ['bitwise_not', 14],
  ['cpp_address_of', 14],
  ['cpp_pointer_deref', 14],
  ['cpp_cast', 14],
  ['cpp_increment_expr', 15],
  ['func_call_expr', 16],
  ['array_access', 16],
])

/** Operator-dependent precedence for concepts with varying operators. */
const OPERATOR_PRECEDENCE: Record<string, (op: unknown) => number> = {
  logic: (op) => op === '||' ? 4 : 5,
  compare: (op) => (op === '==' || op === '!=') ? 8 : 9,
  arithmetic: (op) => (op === '+' || op === '-') ? 11 : 12,
}

/** C++ operator precedence (higher = binds tighter) */
function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  const fixed = PRECEDENCE_MAP.get(node.concept)
  if (fixed !== undefined) return fixed
  const opFn = OPERATOR_PRECEDENCE[node.concept]
  if (opFn) return opFn(node.properties.operator)
  return 100 // literals, var_ref, etc. — never need parens
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

  g.set('cpp_char_literal', (node, _ctx) => {
    const ch = node.properties.char ?? 'a'
    return `'${ch}'`
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
    const childNode = (node.children.value ?? node.children.operand ?? [])[0]
    const val = genChild(childNode, precedence(node), ctx)
    // Prevent --x (pre-decrement) or ++x when nesting unary operators
    if (childNode && (childNode.concept === 'negate' || childNode.concept === 'cpp_pointer_deref' || childNode.concept === 'cpp_address_of')) {
      return `${op}(${val})`
    }
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

  // ─── Generic container expression concepts ───

  g.set('cpp_container_empty', (node) => {
    const obj = node.properties.obj ?? 'obj'
    return `${obj}.empty()`
  })

  g.set('cpp_container_count', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const key = generateExpression((node.children.key ?? [])[0], ctx)
    return `${obj}.count(${key})`
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

  g.set('cpp_lambda', (node, ctx) => {
    const capture = node.properties.capture ?? '&'
    const paramChildren = node.children.params ?? []
    const body = node.children.body ?? []
    const paramStr = paramChildren.map(p => {
      const t = String(p.properties.type ?? 'int')
      const n = String(p.properties.name ?? '')
      return n ? `${t} ${n}` : t
    }).join(', ')
    const returnType = node.properties.return_type
    const retStr = returnType && returnType !== '' ? ` -> ${returnType}` : ''
    let code = `[${capture}](${paramStr})${retStr} {\n`
    code += generateBody(body, indented(ctx))
    code += `}`
    return code
  })

  g.set('cpp_static_cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `static_cast<${targetType}>(${val})`
  })

  g.set('cpp_dynamic_cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'Derived*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `dynamic_cast<${targetType}>(${val})`
  })

  g.set('cpp_reinterpret_cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `reinterpret_cast<${targetType}>(${val})`
  })

  g.set('cpp_const_cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `const_cast<${targetType}>(${val})`
  })

  g.set('cpp_new', (node) => {
    const type = node.properties.type ?? 'int'
    const args = node.properties.args ?? ''
    return args ? `new ${type}(${args})` : `new ${type}`
  })

  g.set('cpp_malloc', (node, ctx) => {
    const type = node.properties.type ?? 'int*'
    const sizeofType = node.properties.sizeof_type ?? 'int'
    const sizeNodes = node.children.size ?? []
    const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : '1'
    return `(${type})malloc(${size} * sizeof(${sizeofType}))`
  })

  g.set('cpp_struct_member_access', (node) => {
    const obj = node.properties.obj ?? 'obj'
    const member = node.properties.member ?? 'field'
    return `${obj}.${member}`
  })

  g.set('cpp_struct_pointer_access', (node) => {
    const ptr = node.properties.ptr ?? 'ptr'
    const member = node.properties.member ?? 'field'
    return `${ptr}->${member}`
  })

  g.set('cpp_method_call_expr', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const method = node.properties.method ?? 'method'
    const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
    const expr = `${obj}.${method}(${args.join(', ')})`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
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
