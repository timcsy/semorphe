import type { Lifter } from '../../../../core/lift/lifter'
import { createNode } from '../../../../core/semantic-tree'
import { tryAstBranches } from '../../../../core/component/lift-branches'

export function registerDeclarationLifters(lifter: Lifter): void {
  // declaration — handled by JSON pattern + liftStrategy (cpp_declaration)
  // expression_statement — handled by JSON unwrap pattern (cpp_expression_statement)

  lifter.register('assignment_expression', (node, ctx) => {
    // **膠囊自己的判別先問**——「左邊長成下標時是我」是元件的知識，不是路由的。
    // 見 `core/component/lift-branches.ts` 的 `registerAstBranch`。
    const 認領 = tryAstBranches('assignment_expression', node, ctx)
    if (認領) return 認領

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
        return createNode('cpp:var_assign_compound', { name: arrName, operator: op }, {
          index: index ? [index] : [],
          value: value ? [value] : [],
        })
      }
      const name = left?.text ?? 'x'
      return createNode('cpp:var_assign_compound', { name, operator: op }, {
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
        return createNode('cpp:array_2d_assign', { obj: name }, {
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
      // 對應表的寫入是另一個概念——見 `expressions.ts` 同位置的說明
      if (ctx.data.getType(name) === 'map') {
        return createNode('cpp:map_assign', { obj: name }, {
          key: index ? [index] : [],
          value: value ? [value] : [],
        })
      }
      return createNode('cpp:array_assign', { obj: name }, {
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
        return createNode('cpp:pointer_assign', { obj: ptrName }, {
          value: value ? [value] : [],
        })
      }
    }

    // Simple variable assignment: x = value
    const name = left?.text ?? 'x'
    return createNode('cpp:var_assign', { obj: name }, {
      value: value ? [value] : [],
    })
  })
}
