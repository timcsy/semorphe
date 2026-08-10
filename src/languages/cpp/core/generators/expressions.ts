import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'

/** C++ operator precedence data (higher = binds tighter). */
const PRECEDENCE_MAP = new Map<string, number>([
  ['cpp:comma_expr', 1],
  ['cpp:var_assign', 2],
  ['cpp:ternary', 3],
  ['cpp:negate', 14],
  ['cpp:logic_not', 14],
  ['cpp:bitwise_not', 14],
  ['cpp:address_of', 14],
  ['cpp:pointer_deref', 14],
  ['cpp:cast', 14],
  ['cpp:array_at', 16],
])

/** Operator-dependent precedence for concepts with varying operators. */
const OPERATOR_PRECEDENCE: Record<string, (op: unknown) => number> = {
  'cpp:logic': (op) => op === '||' ? 4 : 5,
  'cpp:compare': (op) => (op === '==' || op === '!=') ? 8 : 9,
  'cpp:arithmetic': (op) => (op === '+' || op === '-') ? 11 : 12,
}

/** C++ operator precedence (higher = binds tighter) */
function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  const fixed = PRECEDENCE_MAP.get(node.conceptId)
  if (fixed !== undefined) return fixed
  const opFn = OPERATOR_PRECEDENCE[node.conceptId]
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
  g.set('cpp:var_ref', (node, _ctx) => {
    return String(node.properties.name ?? '')
  })

  g.set('cpp:literal_number', (node, _ctx) => {
    return String(node.properties.value ?? '0')
  })

  g.set('cpp:literal_string', (node, _ctx) => {
    return `"${node.properties.value ?? ''}"`
  })

  g.set('cpp:builtin_constant', (node, _ctx) => {
    return String(node.properties.value ?? 'NULL')
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

  g.set('cpp:logic_not', (node, ctx) => {
    const operand = genChild((node.children.operand ?? [])[0], precedence(node), ctx)
    return `!${operand}`
  })

  g.set('cpp:negate', (node, ctx) => {
    const op = (node.properties.operator as string) ?? '-'
    const childNode = (node.children.value ?? node.children.operand ?? [])[0]
    const val = genChild(childNode, precedence(node), ctx)
    // Prevent --x (pre-decrement) or ++x when nesting unary operators
    if (childNode && (childNode.conceptId === 'cpp:negate' || childNode.conceptId === 'cpp:pointer_deref' || childNode.conceptId === 'cpp:address_of')) {
      return `${op}(${val})`
    }
    return `${op}${val}`
  })


  g.set('cpp:ternary', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const trueExpr = generateExpression((node.children.true_expr ?? [])[0], ctx)
    const falseExpr = generateExpression((node.children.false_expr ?? [])[0], ctx)
    return `${cond} ? ${trueExpr} : ${falseExpr}`
  })

  g.set('cpp:cast', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `(${targetType})${val}`
  })

  g.set('cpp:bitwise_not', (node, ctx) => {
    const operand = generateExpression((node.children.operand ?? [])[0], ctx)
    return `~${operand}`
  })

  g.set('cpp:address_of', (node, ctx) => {
    const v = generateExpression((node.children.var ?? [])[0], ctx)
    return `&${v}`
  })

  g.set('cpp:pointer_deref', (node, ctx) => {
    const ptr = generateExpression((node.children.ptr ?? [])[0], ctx)
    return `*${ptr}`
  })

  g.set('cpp:comma_expr', (node, ctx) => {
    const exprs = (node.children.exprs ?? []).map(e => generateExpression(e, ctx))
    return exprs.join(', ')
  })

  // ─── Generic container expression concepts ───

  g.set('cpp:container_empty', (node) => {
    const obj = node.properties.obj ?? 'obj'
    return `${obj}.empty()`
  })

  g.set('cpp:container_count', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const key = generateExpression((node.children.key ?? [])[0], ctx)
    return `${obj}.count(${key})`
  })

  // Expression versions of statement-only blocks (no indent, no semicolons)


  // cpp_scanf_expr moved to std/cstdio/generators.ts



  g.set('cpp:cast_static', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `static_cast<${targetType}>(${val})`
  })

  g.set('cpp:cast_dynamic', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'Derived*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `dynamic_cast<${targetType}>(${val})`
  })

  g.set('cpp:cast_reinterpret', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `reinterpret_cast<${targetType}>(${val})`
  })

  g.set('cpp:cast_const', (node, ctx) => {
    const targetType = node.properties.target_type ?? 'int*'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `const_cast<${targetType}>(${val})`
  })



  g.set('cpp:malloc', (node, ctx) => {
    const type = node.properties.type ?? 'int*'
    const sizeNodes = node.children.size ?? []
    const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : '1'
    // If sizeof_type is explicitly set (from block), use structured formula
    if (node.properties.sizeof_type) {
      return `(${type})malloc(${size} * sizeof(${node.properties.sizeof_type}))`
    }
    // From lifter: size child is the full malloc argument expression
    return `(${type})malloc(${size})`
  })

  g.set('cpp:struct_at_member', (node) => {
    const obj = node.properties.obj ?? 'obj'
    const member = node.properties.member ?? 'field'
    return `${obj}.${member}`
  })

  g.set('cpp:struct_at_ptr', (node) => {
    const ptr = node.properties.obj ?? 'ptr'
    const member = node.properties.member ?? 'field'
    return `${ptr}->${member}`
  })


}
