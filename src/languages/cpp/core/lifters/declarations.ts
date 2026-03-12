import type { Lifter } from '../../../../core/lift/lifter'
import { createNode } from '../../../../core/semantic-tree'

export function registerDeclarationLifters(lifter: Lifter): void {
  // declaration — handled by JSON pattern + liftStrategy (cpp_declaration)
  // expression_statement — handled by JSON unwrap pattern (cpp_expression_statement)

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

    // 2D Array element assignment: arr[i][j] = value
    if (left?.type === 'subscript_expression') {
      const innerNode = left.childForFieldName('argument') ?? left.namedChildren[0]
      if (innerNode?.type === 'subscript_expression') {
        const arrayNode = innerNode.childForFieldName('argument') ?? innerNode.namedChildren[0]
        const name = arrayNode?.text ?? 'arr'
        const rowIndices = innerNode.namedChildren.find(c => c.type === 'subscript_argument_list')
        const rowNode = rowIndices?.namedChildren[0] ?? innerNode.namedChildren[1]
        const colIndices = left.namedChildren.find(c => c.type === 'subscript_argument_list')
        const colNode = colIndices?.namedChildren[0] ?? left.namedChildren[1]
        const row = rowNode ? ctx.lift(rowNode) : null
        const col = colNode ? ctx.lift(colNode) : null
        return createNode('cpp_array_2d_assign', { name }, {
          row: row ? [row] : [],
          col: col ? [col] : [],
          value: value ? [value] : [],
        })
      }

      // 1D Array element assignment: arr[i] = value
      const name = innerNode?.text ?? 'arr'
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
