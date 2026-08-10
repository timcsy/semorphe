/** `cpp:lambda` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { liftParamList, extractBody } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // lambda_expression: [capture](params) -> ret { body }
    registry.register('cpp:liftLambda', (node, ctx) => {
      const captureSpec = node.namedChildren.find(c => c.type === 'lambda_capture_specifier')
      let capture = '&'
      if (captureSpec) {
        const inner = captureSpec.text.slice(1, -1) // strip [ ]
        capture = inner || ''
      }
      const declNode = node.namedChildren.find(c => c.type === 'abstract_function_declarator')
      const paramList = declNode?.namedChildren.find(c => c.type === 'parameter_list') ?? null
      const params = liftParamList(paramList, ctx)
      const trailingReturn = declNode?.namedChildren.find(c => c.type === 'trailing_return_type')
      const returnType = trailingReturn ? trailingReturn.text.replace(/^->\s*/, '') : ''
      const bodyNode = node.namedChildren.find(c => c.type === 'compound_statement') ?? null
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:lambda', { capture, return_type: returnType }, { params, body })
    })
}
