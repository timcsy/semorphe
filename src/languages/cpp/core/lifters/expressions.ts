import type { Lifter } from '../../../../core/lift/lifter'
import type { SemanticNode } from '../../../../core/types'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import { createNode } from '../../../../core/semantic-tree'

const ARITHMETIC_OPS = new Set(['+', '-', '*', '/', '%'])
const COMPARE_OPS = new Set(['>', '<', '>=', '<=', '==', '!='])
const LOGIC_OPS = new Set(['&&', '||'])

export function registerExpressionLifters(lifter: Lifter): void {
  lifter.register('number_literal', (node) => {
    return createNode('number_literal', { value: node.text })
  })

  // Built-in constants: identifiers that are language keywords/constants
  const BUILTIN_CONSTANTS = new Set(['EOF', 'NULL', 'nullptr', 'true', 'false', 'INT_MAX', 'INT_MIN', 'LLONG_MAX', 'LLONG_MIN', 'SIZE_MAX'])

  lifter.register('identifier', (node) => {
    const name = node.text
    if (BUILTIN_CONSTANTS.has(name)) {
      return createNode('builtin_constant', { value: name })
    }
    return createNode('var_ref', { name })
  })

  lifter.register('true', () => createNode('builtin_constant', { value: 'true' }))
  lifter.register('false', () => createNode('builtin_constant', { value: 'false' }))
  lifter.register('null', () => createNode('builtin_constant', { value: 'NULL' }))
  lifter.register('nullptr', () => createNode('builtin_constant', { value: 'nullptr' }))

  lifter.register('binary_expression', (node, ctx) => {
    const leftNode = node.childForFieldName('left')
    const rightNode = node.childForFieldName('right')

    // Find operator (unnamed child between left and right)
    let op = '+'
    for (const child of node.children) {
      if (!child.isNamed && child.text !== '(' && child.text !== ')') {
        op = child.text
        break
      }
    }

    // Handle cout << x << y  and  cin >> x >> y
    if (op === '<<') {
      const coutValues = extractCoutChain(node, ctx)
      if (coutValues) {
        return createNode('print', {}, { values: coutValues })
      }
    }
    if (op === '>>') {
      const cinValues = extractCinChain(node, ctx)
      if (cinValues) {
        return createNode('input', {}, { values: cinValues })
      }
    }

    const left = leftNode ? ctx.lift(leftNode) : null
    const right = rightNode ? ctx.lift(rightNode) : null

    let concept: string
    if (ARITHMETIC_OPS.has(op)) concept = 'arithmetic'
    else if (COMPARE_OPS.has(op)) concept = 'compare'
    else if (LOGIC_OPS.has(op)) concept = 'logic'
    else concept = 'arithmetic' // fallback

    return createNode(concept, { operator: op }, {
      left: left ? [left] : [],
      right: right ? [right] : [],
    })
  })

  lifter.register('unary_expression', (node, ctx) => {
    const op = node.children.find(c => !c.isNamed)?.text ?? ''
    const operandNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    const operand = operandNode ? ctx.lift(operandNode) : null

    if (op === '!') {
      return createNode('logic_not', {}, {
        operand: operand ? [operand] : [],
      })
    }
    if (op === '-') {
      return createNode('negate', {}, {
        value: operand ? [operand] : [],
      })
    }
    if (op === '~') {
      return createNode('bitwise_not', {}, {
        operand: operand ? [operand] : [],
      })
    }
    if (op === '&') {
      return createNode('cpp_address_of', {}, {
        var: operand ? [operand] : [],
      })
    }
    if (op === '*') {
      return createNode('cpp_pointer_deref', {}, {
        ptr: operand ? [operand] : [],
      })
    }

    // Fallback for other unary ops (++, --, etc.)
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: node.text }
    return raw
  })

  lifter.register('update_expression', (node, ctx) => {
    // i++ / ++i / i-- / --i
    const op = node.children.find(c => !c.isNamed)?.text ?? '++'
    const nameNode = node.namedChildren[0]
    // Prefix if operator comes before the operand
    const firstChild = node.children[0]
    const position = (!firstChild?.isNamed && (firstChild?.text === '++' || firstChild?.text === '--')) ? 'prefix' : 'postfix'

    // Array element increment: arr[i]++ / --arr[i]
    if (nameNode?.type === 'subscript_expression') {
      const arrayNode = nameNode.childForFieldName('argument') ?? nameNode.namedChildren[0]
      const arrName = arrayNode?.text ?? 'arr'
      const indicesNode = nameNode.namedChildren.find(c => c.type === 'subscript_argument_list')
      const indexNode = indicesNode?.namedChildren[0] ?? nameNode.childForFieldName('index') ?? nameNode.namedChildren[1]
      const index = indexNode ? ctx.lift(indexNode) : null
      return createNode('cpp_increment', { name: arrName, operator: op, position }, {
        index: index ? [index] : [],
      })
    }

    const name = nameNode?.text ?? 'i'
    return createNode('cpp_increment', { name, operator: op, position })
  })

  lifter.register('parenthesized_expression', (node, ctx) => {
    // Unwrap parenthesized expressions
    if (node.namedChildren.length === 1) {
      return ctx.lift(node.namedChildren[0])
    }
    return null
  })

  // Pointer expression: *ptr (deref) or &x (address-of)
  lifter.register('pointer_expression', (node, ctx) => {
    const op = node.children.find(c => !c.isNamed)?.text ?? ''
    const operandNode = node.namedChildren[0]
    const operand = operandNode ? ctx.lift(operandNode) : null
    if (op === '&') {
      return createNode('cpp_address_of', {}, {
        var: operand ? [operand] : [],
      })
    }
    if (op === '*') {
      return createNode('cpp_pointer_deref', {}, {
        ptr: operand ? [operand] : [],
      })
    }
    return operand
  })

  // Comma expression: i++, j-- (used in for-loop updates)
  lifter.register('comma_expression', (node, ctx) => {
    const children = node.namedChildren.map(c => ctx.lift(c)).filter(Boolean) as SemanticNode[]
    return createNode('cpp_comma_expr', {}, { exprs: children })
  })

  // C-style cast: (double)x, (int)y
  lifter.register('cast_expression', (node, ctx) => {
    const typeNode = node.childForFieldName('type')
    const valueNode = node.childForFieldName('value')
    const targetType = typeNode?.text ?? 'int'
    const value = valueNode ? ctx.lift(valueNode) : null
    return createNode('cpp_cast', { target_type: targetType }, {
      value: value ? [value] : [],
    })
  })

  // Ternary / conditional expression: cond ? true_expr : false_expr
  lifter.register('conditional_expression', (node, ctx) => {
    const condNode = node.childForFieldName('condition')
    const trueNode = node.childForFieldName('consequence')
    const falseNode = node.childForFieldName('alternative')
    const cond = condNode ? ctx.lift(condNode) : null
    const trueExpr = trueNode ? ctx.lift(trueNode) : null
    const falseExpr = falseNode ? ctx.lift(falseNode) : null
    return createNode('cpp_ternary', {}, {
      condition: cond ? [cond] : [],
      true_expr: trueExpr ? [trueExpr] : [],
      false_expr: falseExpr ? [falseExpr] : [],
    })
  })

  lifter.register('subscript_expression', (node, ctx) => {
    const arrayNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    const name = arrayNode?.text ?? 'arr'
    // tree-sitter C++ wraps index in subscript_argument_list: arr[i] → (subscript_argument_list (identifier))
    const indicesNode = node.namedChildren.find(c => c.type === 'subscript_argument_list')
    const indexNode = indicesNode?.namedChildren[0] ?? node.childForFieldName('index') ?? node.namedChildren[1]
    const index = indexNode ? ctx.lift(indexNode) : null
    return createNode('array_access', { name }, {
      index: index ? [index] : [],
    })
  })
}

/**
 * Extract cout << x << y << endl chain.
 * Tree-sitter parses "cout << x << y" as nested binary_expression:
 *   (binary_expression left: (binary_expression left: "cout" right: "x") right: "y")
 * Returns null if the leftmost identifier is not cout.
 */
function extractCoutChain(node: AstNode, ctx: LiftContext): SemanticNode[] | null {
  const values: SemanticNode[] = []
  let current: AstNode | null = node

  // Walk left-recursively to collect all << operands
  while (current && current.type === 'binary_expression') {
    const op = current.children.find(c => !c.isNamed && c.text === '<<')
    if (!op) break

    const rightNode = current.childForFieldName('right')
    if (rightNode) {
      // Check for endl
      if (rightNode.text === 'endl') {
        values.unshift(createNode('endl', {}))
      } else {
        const lifted = ctx.lift(rightNode)
        if (lifted) values.unshift(lifted)
      }
    }
    current = current.childForFieldName('left')
  }

  // Check if the base is "cout"
  if (!current || current.text !== 'cout') return null
  return values
}

/**
 * Extract cin >> x >> y chain. Returns array of semantic nodes (var_ref or array_access) or null.
 */
function extractCinChain(node: AstNode, ctx: LiftContext): SemanticNode[] | null {
  const values: SemanticNode[] = []
  let current: AstNode | null = node

  while (current && current.type === 'binary_expression') {
    const op = current.children.find(c => !c.isNamed && c.text === '>>')
    if (!op) break
    const rightNode = current.childForFieldName('right')
    if (rightNode) {
      if (rightNode.type === 'subscript_expression') {
        // cin >> arr[i] — lift as array_access
        const lifted = ctx.lift(rightNode)
        if (lifted) values.unshift(lifted)
      } else {
        values.unshift(createNode('var_ref', { name: rightNode.text }))
      }
    }
    current = current.childForFieldName('left')
  }

  if (!current || current.text !== 'cin') return null
  return values.length > 0 ? values : null
}
