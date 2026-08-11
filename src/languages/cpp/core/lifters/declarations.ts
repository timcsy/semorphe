import type { Lifter } from '../../../../core/lift/lifter'
import { tryAstBranches } from '../../../../core/component/lift-branches'
import { 建var_assign_compound } from '../../../../components/cpp/var_assign_compound/lift'
import { 建var_assign } from '../../../../components/cpp/var_assign/lift'
import { 建array_assign } from '../../../../components/cpp/array_assign/lift'

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
        return 建var_assign_compound(arrName, op, value, index)
      }
      const name = left?.text ?? 'x'
      return 建var_assign_compound(name, op, value)
    }

    if (left?.type === 'subscript_expression') {
      const innerNode = left.childForFieldName('argument') ?? left.namedChildren[0]
      // 1D Array element assignment: arr[i] = value
      const name = innerNode?.text ?? 'arr'
      const indicesNode = left.namedChildren.find(c => c.type === 'subscript_argument_list')
      const indexNode = indicesNode?.namedChildren[0] ?? left.childForFieldName('index') ?? left.namedChildren[1]
      const index = indexNode ? ctx.lift(indexNode) : null
      // 對應表的寫入是另一個概念——見 `expressions.ts` 同位置的說明
      return 建array_assign(name, {
        index: index ? [index] : [],
        value: value ? [value] : [],
      })
    }

    // Simple variable assignment: x = value
    const name = left?.text ?? 'x'
    return 建var_assign(name, {
      value: value ? [value] : [],
    })
  })
}
