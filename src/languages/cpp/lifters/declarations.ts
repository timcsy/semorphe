import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'

export function registerDeclarationLifters(lifter: Lifter): void {
  // declaration now handled by liftStrategy "cpp:liftDeclaration"

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
    const op = node.children.find(c => !c.isNamed)?.text ?? '='
    const value = right ? ctx.lift(right) : null

    // Compound assignment: +=, -=, *=, /=, %=
    if (op !== '=') {
      // Array element compound assign: arr[i] += value
      if (left?.type === 'subscript_expression') {
        const arrayNode = left.childForFieldName('argument') ?? left.namedChildren[0]
        const arrName = arrayNode?.text ?? 'arr'
        const indicesNode = left.namedChildren.find(c => c.type === 'subscript_argument_list')
        const indexNode = indicesNode?.namedChildren[0] ?? left.childForFieldName('index') ?? left.namedChildren[1]
        const index = indexNode ? ctx.lift(indexNode) : null
        return createNode('cpp_compound_assign', { name: arrName, operator: op }, {
          index: index ? [index] : [],
          value: value ? [value] : [],
        })
      }
      const name = left?.text ?? 'x'
      return createNode('cpp_compound_assign', { name, operator: op }, {
        value: value ? [value] : [],
      })
    }

    // Array element assignment: arr[i] = value
    if (left?.type === 'subscript_expression') {
      const arrayNode = left.childForFieldName('argument') ?? left.namedChildren[0]
      const name = arrayNode?.text ?? 'arr'
      const indicesNode = left.namedChildren.find(c => c.type === 'subscript_argument_list')
      const indexNode = indicesNode?.namedChildren[0] ?? left.childForFieldName('index') ?? left.namedChildren[1]
      const index = indexNode ? ctx.lift(indexNode) : null
      return createNode('array_assign', { name }, {
        index: index ? [index] : [],
        value: value ? [value] : [],
      })
    }

    // Pointer dereference assignment: *ptr = value
    if (left?.type === 'pointer_expression') {
      const ptrOp = left.children.find(c => !c.isNamed)?.text
      if (ptrOp === '*') {
        const ptrNameNode = left.namedChildren[0]
        const ptrName = ptrNameNode?.text ?? 'ptr'
        return createNode('cpp_pointer_assign', { ptr_name: ptrName }, {
          value: value ? [value] : [],
        })
      }
    }

    // Simple variable assignment: x = value
    const name = left?.text ?? 'x'
    return createNode('var_assign', { name }, {
      value: value ? [value] : [],
    })
  })
}
