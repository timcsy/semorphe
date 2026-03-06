import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode } from '../../../core/types'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'

function liftSingleDeclarator(decl: AstNode, type: string, ctx: LiftContext): SemanticNode {
  // Array declarator: int arr[10]
  if (decl.type === 'array_declarator') {
    const name = decl.namedChildren[0]?.text ?? 'arr'
    const sizeNode = decl.namedChildren[1]
    const size = sizeNode?.text ?? '10'
    return createNode('array_declare', { type, name, size })
  }

  // Plain identifier: int x
  if (decl.type === 'identifier') {
    return createNode('var_declare', { name: decl.text, type })
  }

  // init_declarator: name = value
  const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
  const name = nameNode?.text ?? 'x'

  // Array init_declarator: int arr[10] = {...}
  if (nameNode?.type === 'array_declarator') {
    const arrName = nameNode.namedChildren[0]?.text ?? 'arr'
    const sizeNode = nameNode.namedChildren[1]
    const size = sizeNode?.text ?? '10'
    return createNode('array_declare', { type, name: arrName, size })
  }

  const valueNode = decl.childForFieldName('value')
  if (valueNode) {
    const value = ctx.lift(valueNode)
    return createNode('var_declare', { name, type }, {
      initializer: value ? [value] : [],
    })
  }

  return createNode('var_declare', { name, type })
}

export function registerDeclarationLifters(lifter: Lifter): void {
  lifter.register('declaration', (node, ctx) => {
    // Find type
    const typeNode = node.namedChildren.find(c => c.type === 'primitive_type' || c.type === 'type_identifier' || c.type === 'qualified_identifier' || c.type === 'sized_type_specifier')
    const type = typeNode?.text ?? 'int'

    // Find declarators
    const declarators = node.namedChildren.filter(c => c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'array_declarator')

    if (declarators.length === 0) {
      return createNode('var_declare', { name: 'x', type })
    }

    // Lift each declarator individually
    const liftedNodes = declarators.map(decl => liftSingleDeclarator(decl, type, ctx))

    // Single declarator → return directly
    if (liftedNodes.length === 1) return liftedNodes[0]

    // Multiple declarators → wrap in _compound so parent unwraps them
    return createNode('_compound', {}, { body: liftedNodes })
  })

  lifter.register('expression_statement', (node, ctx) => {
    // Unwrap expression statements
    if (node.namedChildren.length === 1) {
      const lifted = ctx.lift(node.namedChildren[0])
      // func_call_expr in statement context → convert to func_call (statement block)
      if (lifted && lifted.concept === 'func_call_expr') {
        return createNode('func_call', lifted.properties, lifted.children)
      }
      return lifted
    }
    return null
  })

  lifter.register('assignment_expression', (node, ctx) => {
    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')
    const name = left?.text ?? 'x'
    const value = right ? ctx.lift(right) : null
    return createNode('var_assign', { name }, {
      value: value ? [value] : [],
    })
  })
}
