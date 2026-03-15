import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import { registerStatementLifters } from '../core/lifters/statements'
import { registerDeclarationLifters } from '../core/lifters/declarations'
import { registerExpressionLifters } from '../core/lifters/expressions'
import { registerCppTransforms } from '../core/lifters/transforms'
import { registerCppLiftStrategies } from '../core/lifters/strategies'
import { registerCppRenderStrategies } from '../renderers/strategies'
import { registerIOLifters } from './io'
import { allStdModules } from '../std'
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

  // Core lifters
  registerStatementLifters(lifter)
  registerDeclarationLifters(lifter)
  registerExpressionLifters(lifter)

  // IO lifters (dispatcher for call_expression: printf/scanf/general func_call)
  registerIOLifters(lifter)

  // Std module lifters
  for (const mod of allStdModules) {
    mod.registerLifters(lifter)
  }

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

  // #ifdef NAME
  lifter.register('preproc_ifdef', (node) => {
    const nameNode = node.childForFieldName('name')
    const name = nameNode?.text ?? 'MACRO'
    return createNode('cpp_ifdef', { name })
  })

  // #ifndef NAME
  lifter.register('preproc_ifndef', (node) => {
    const nameNode = node.childForFieldName('name')
    const name = nameNode?.text ?? 'MACRO'
    return createNode('cpp_ifndef', { name })
  })
}
