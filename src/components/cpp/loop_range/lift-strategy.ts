/** `cpp:loop_range` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftRangeFor', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { extractBody } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // for_range_loop: for (auto x : vec) { body }
    registry.register('cpp:liftRangeFor', (node, ctx) => {
      const qualifierNode = node.namedChildren.find(c => c.type === 'type_qualifier')
      const typeNode = node.namedChildren.find(c =>
        c.type === 'primitive_type' || c.type === 'type_identifier' ||
        c.type === 'placeholder_type_specifier' || c.type === 'template_type'
      )
      // Handle reference/pointer declarators: for (const string& w : container)
      // In this case, the loop var `w` lives inside reference_declarator, not as a bare identifier
      const refDeclNode = node.namedChildren.find(c =>
        c.type === 'reference_declarator' || c.type === 'pointer_declarator'
      )
      let varNode: AstNode | null
      if (refDeclNode) {
        varNode = refDeclNode.namedChildren.find((c: AstNode) => c.type === 'identifier') ?? null
      } else {
        varNode = node.namedChildren.find(c => c.type === 'identifier') ?? null
      }
      const varName = varNode?.text ?? 'x'
      // Build varType with const qualifier and reference sigil if present
      const baseType = typeNode?.text ?? 'auto'
      const qualifier = qualifierNode?.text ? qualifierNode.text + ' ' : ''
      const refSigil = refDeclNode?.type === 'reference_declarator' ? '&' : refDeclNode?.type === 'pointer_declarator' ? '*' : ''
      const varType = `${qualifier}${baseType}${refSigil}`
      // The container is the "right" field
      const rightNode = node.childForFieldName('right')
      const container = rightNode?.text ?? 'vec'
      const bodyNode = node.childForFieldName('body') ?? node.namedChildren.find(c => c.type === 'compound_statement') ?? null
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:loop_range', { var_type: varType, var_name: varName, container }, { body })
    })
}
