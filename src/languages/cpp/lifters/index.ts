import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import { registerDeclarationLifters } from './declarations'
import { registerExpressionLifters } from './expressions'
import { registerStatementLifters } from './statements'
import { registerIOLifters } from './io'
import { registerCppTransforms } from './transforms'
import { registerCppLiftStrategies } from './strategies'
import { registerCppRenderStrategies } from '../renderers/strategies'
import type { TransformRegistry } from '../../../core/registry/transform-registry'
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { RenderStrategyRegistry } from '../../../core/registry/render-strategy-registry'

export interface CppRegistries {
  transformRegistry?: TransformRegistry
  liftStrategyRegistry?: LiftStrategyRegistry
  renderStrategyRegistry?: RenderStrategyRegistry
}

export function registerCppLifters(lifter: Lifter, registries?: CppRegistries): void {
  // Register C++ transforms (Layer 2)
  if (registries?.transformRegistry) {
    registerCppTransforms(registries.transformRegistry)
  }

  // Register C++ lift strategies (Layer 3)
  if (registries?.liftStrategyRegistry) {
    registerCppLiftStrategies(registries.liftStrategyRegistry)
  }

  // Register C++ render strategies (Layer 3)
  if (registries?.renderStrategyRegistry) {
    registerCppRenderStrategies(registries.renderStrategyRegistry)
  }

  registerStatementLifters(lifter)
  registerDeclarationLifters(lifter)
  registerExpressionLifters(lifter)
  registerIOLifters(lifter)

  // preproc_include now handled by liftStrategy "cpp:liftPreprocInclude"

  // using namespace std;
  lifter.register('using_declaration', (node) => {
    const text = node.text
    const match = text.match(/using\s+namespace\s+(\w+)\s*;?/)
    if (match) {
      return createNode('cpp_using_namespace', { ns: match[1] })
    }
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: text }
    return raw
  })

  // #define NAME VALUE
  lifter.register('preproc_def', (node) => {
    const nameNode = node.childForFieldName('name')
    const valueNode = node.childForFieldName('value')
    const name = nameNode?.text ?? 'MACRO'
    const value = valueNode?.text ?? ''
    return createNode('cpp_define', { name, value })
  })
}
