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

  // #ifdef NAME / #ifndef NAME
  // tree-sitter C++ parses both #ifdef and #ifndef as preproc_ifdef node type.
  // Distinguish by checking the source text for the #ifndef directive.
  lifter.register('preproc_ifdef', (node, ctx) => {
    const nameNode = node.childForFieldName('name')
    const name = nameNode?.text ?? 'MACRO'
    // **body 原本整段被丟掉**——於是 `#ifdef N` 之間的程式碼在語義樹裡不存在，
    // 執行時自然什麼都不會發生，而且沒有任何提示。
    // 屬性名同時對齊概念宣告（`condition`），舊的 `name` 一併保留給既有存檔。
    // 過濾掉巨集名本身——`childForFieldName('name')` 在這個位置不一定回傳它，
    // 只比對物件參照的話，`N` 會被當成變數引用 lift 進 body（實測過）。
    const isMacroName = (c: { type: string; text: string }): boolean =>
      c.type === 'identifier' && c.text === name
    const body = ctx.liftChildren(
      node.namedChildren.filter(
        (c) => c !== nameNode && !isMacroName(c) && c.type !== 'preproc_arg',
      ),
    )
    const concept = node.text.trimStart().startsWith('#ifndef') ? 'cpp_ifndef' : 'cpp_ifdef'
    return createNode(concept, { condition: name, name }, { body })
  })

  // Keep preproc_ifndef registration in case future tree-sitter versions separate them
  lifter.register('preproc_ifndef', (node, ctx) => {
    const nameNode = node.childForFieldName('name')
    const name = nameNode?.text ?? 'MACRO'
    // 過濾掉巨集名本身——`childForFieldName('name')` 在這個位置不一定回傳它，
    // 只比對物件參照的話，`N` 會被當成變數引用 lift 進 body（實測過）。
    const isMacroName = (c: { type: string; text: string }): boolean =>
      c.type === 'identifier' && c.text === name
    const body = ctx.liftChildren(
      node.namedChildren.filter(
        (c) => c !== nameNode && !isMacroName(c) && c.type !== 'preproc_arg',
      ),
    )
    return createNode('cpp_ifndef', { condition: name, name }, { body })
  })
}
