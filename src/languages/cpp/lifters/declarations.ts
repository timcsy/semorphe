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
    const name = left?.text ?? 'x'
    const value = right ? ctx.lift(right) : null
    return createNode('var_assign', { name }, {
      value: value ? [value] : [],
    })
  })
}
