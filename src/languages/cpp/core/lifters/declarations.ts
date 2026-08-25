import type { Lifter } from '../../../../core/lift/lifter'
import { tryAstBranches } from '../../../../core/component/lift-branches'
import { buildVarAssignCompound } from '../../../../components/cpp/var_assign_compound/lift'
import { buildVarAssign } from '../../../../components/cpp/var_assign/lift'
import { buildArrayAssign } from '../../../../components/cpp/array_assign/lift'

export function registerDeclarationLifters(lifter: Lifter): void {
  // declaration — handled by JSON pattern + liftStrategy (cpp_declaration)
  // expression_statement — handled by JSON unwrap pattern (cpp_expression_statement)

  lifter.register('assignment_expression', (node, ctx) => {
    // **膠囊自己的判別先問**——「左邊長成下標時是我」是元件的知識，不是路由的。
    // 見 `core/component/lift-branches.ts` 的 `registerAstBranch`。
    const claim = tryAstBranches('assignment_expression', node, ctx)
    if (claim) return claim

    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')
    const op = node.children.find(c => !c.isNamed)?.text ?? '='
    const value = right ? ctx.lift(right) : null

    // Compound assignment: +=, -=, *=, /=, %=
    //
    // 🟢 **左邊就 lift**（2026-08-25）——不再判它長什麼樣。
    // 🪦 這裡本來有一段 `subscript_expression` 的特例，而**左值不只兩種**：
    //    `o.x`／`p->x`／`*q`／`a[i][j]` 全部合法，而它們全部被 `left.text`
    //    壓進一個字串，於是執行期去查一個叫 `p->x` 的變數。
    if (op !== '=') {
      return buildVarAssignCompound(op, value, left ? ctx.lift(left) : null)
    }

    if (left?.type === 'subscript_expression') {
      const innerNode = left.childForFieldName('argument') ?? left.namedChildren[0]
      // 1D Array element assignment: arr[i] = value
      const name = innerNode?.text ?? 'arr'
      const indicesNode = left.namedChildren.find(c => c.type === 'subscript_argument_list')
      const indexNode = indicesNode?.namedChildren[0] ?? left.childForFieldName('index') ?? left.namedChildren[1]
      const index = indexNode ? ctx.lift(indexNode) : null
      // 對應表的寫入是另一個概念——見 `expressions.ts` 同位置的說明
      return buildArrayAssign(name, {
        index: index ? [index] : [],
        value: value ? [value] : [],
      })
    }

    // Simple variable assignment: x = value
    const name = left?.text ?? 'x'
    return buildVarAssign(name, {
      value: value ? [value] : [],
    })
  })
}
