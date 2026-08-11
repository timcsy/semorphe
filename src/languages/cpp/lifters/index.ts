import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import { registerStatementLifters } from '../core/lifters/statements'
import { registerDeclarationLifters } from '../core/lifters/declarations'
import { registerExpressionLifters, cppStreamRead } from '../core/lifters/expressions'
import { registerCppTransforms } from '../core/lifters/transforms'
import { registerCppLiftStrategies } from '../core/lifters/strategies'
import { registerCppRenderStrategies } from '../renderers/strategies'
import { registerIOLifters } from './io'
import { declareLiftPostProcessor } from '../../../core/lift/post-processors'
import { allStdModules } from '../std'
import { componentLiftRegistrars, componentLiftStrategyRegistrars } from '../../../core/component/paths'
import type { TransformRegistry } from '../../../core/registry/transform-registry'
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { RenderStrategyRegistry } from '../../../core/registry/render-strategy-registry'
import { qualifierConcept } from '../../../core/component/qualifier-concepts'

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
  const 策略表 = registries?.liftStrategyRegistry
  if (策略表) {
    registerCppLiftStrategies(策略表)
    // 膠囊的具名辨識策略（`lift-strategy.ts`）——與 `lift.ts` 是不同的登錄表
    for (const reg of componentLiftStrategyRegistrars())
      (reg as (r: typeof 策略表) => void)(策略表)
  }

  // Register C++ render strategies (Layer 3)
  if (registries?.renderStrategyRegistry) {
    registerCppRenderStrategies(registries.renderStrategyRegistry)
  }

  // 推給核心的辨識後處理——判準寫著 C++ 的型別名，核心不該認得它們
  declareLiftPostProcessor(cppStreamRead)

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

  // 元件膠囊的 lift 路
  for (const reg of componentLiftRegistrars()) (reg as (l: typeof lifter) => void)(lifter)
  // ✅ **過渡表已退場**（2026-08-11）：`pending-containers.ts` 那六顆容器
  // 全部進了膠囊，各自登錄自己的型別名。那個檔的檔頭寫著
  // 「這張表歸零的那天就刪掉這個檔」——照做了。

  // preproc_include now handled by liftStrategy "cpp:liftPreprocInclude"

  // using namespace std;
  lifter.register('using_declaration', (node) => {
    const text = node.text
    const match = text.match(/using\s+namespace\s+(\w+)\s*;?/)
    if (match) {
      return createNode('cpp:using_namespace', { ns: match[1] })
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
    return createNode('cpp:define', { name, value })
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
    // 指令 → 身分由膠囊登錄（`core/component/qualifier-concepts.ts`）。
    // 這裡只認語法：開頭是不是 `#ifndef`。
    const 指令 = node.text.trimStart().startsWith('#ifndef') ? 'ifndef' : 'ifdef'
    const concept = qualifierConcept(指令)
    if (!concept) return null
    // ⚠️ 原本寫 `{ condition: name, name }`——**同一個值兩個名字**，
    // 而執行器對應地寫著 `properties.condition ?? properties.name`。
    // 兩個名字不是相容層，是重複：沒有任何情境只有其中一個。已收斂成 `condition`。
    return createNode(concept, { condition: name }, { body })
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
    // ⚠️ 上面那段的註解寫著「兩個名字已收斂成 `condition`」，**而這一處沒收**
    // ——同一個修法只套用在發現它的那一處。一併收了。
    const concept2 = qualifierConcept('ifndef')
    if (!concept2) return null
    return createNode(concept2, { condition: name }, { body })
  })
}
