/** `cpp:try_catch` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftTryCatch', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { parseParamDeclaration, extractBody } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // try_statement: try { } catch (type name) { }
    registry.register('cpp:liftTryCatch', (node, ctx) => {
      const tryBody = extractBody(node.childForFieldName('body') ?? null, ctx)
      const catchClause = node.namedChildren.find(c => c.type === 'catch_clause') ?? null
      let catchType = 'exception&'
      let catchName = 'e'
      let catchBody: SemanticNode[] = []
      if (catchClause) {
        const paramList = catchClause.childForFieldName('parameters')
          ?? catchClause.namedChildren.find(c => c.type === 'parameter_list')
        if (paramList) {
          const param = paramList.namedChildren.find(c => c.type === 'parameter_declaration')
          if (param) {
            const { type, name } = parseParamDeclaration(param)
            catchType = type
            catchName = name
          }
        }
        const catchBodyNode = catchClause.childForFieldName('body') ?? null
        catchBody = extractBody(catchBodyNode, ctx)
      }
      return createNode('cpp:try_catch', { catch_type: catchType, catch_name: catchName }, {
        try_body: tryBody,
        catch_body: catchBody,
      })
    })
}
