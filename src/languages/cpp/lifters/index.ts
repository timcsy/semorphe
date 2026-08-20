import type { Lifter } from '../../../core/lift/lifter'
import { declareStandaloneBlockBuilder } from '../../../core/standalone-block'
import { buildBlock } from '../../../components/cpp/block/lift'
import { createNode } from '../../../core/semantic-tree'
import { registerStatementLifters } from '../core/lifters/statements'
import { registerDeclarationLifters } from '../core/lifters/declarations'
import { registerExpressionLifters, cppStreamRead } from '../core/lifters/expressions'
import { registerCppTransforms } from '../core/lifters/transforms'
import { registerCppLiftStrategies } from '../core/lifters/strategies'
import { registerCppRenderStrategies } from '../renderers/strategies'
import { registerIOLifters } from './io'
import { declareLiftPostProcessor } from '../../../core/lift/post-processors'
import { componentLiftRegistrars, componentLiftStrategyRegistrars } from '../../../core/component/paths'
import type { TransformRegistry } from '../../../core/registry/transform-registry'
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { RenderStrategyRegistry } from '../../../core/registry/render-strategy-registry'
import { qualifierComponent } from '../../../core/component/qualifier-components'
import { buildUsingNamespace } from '../../../components/cpp/using_namespace/lift'
import { buildDefine } from '../../../components/cpp/define/lift'

export interface CppRegistries {
  transformRegistry?: TransformRegistry
  liftStrategyRegistry?: LiftStrategyRegistry
  renderStrategyRegistry?: RenderStrategyRegistry
}

/**
 * 註冊 C++ 的手寫 lifter。
 *
 * 🔴 **整批包在 `registerFor('tree-sitter-cpp')` 裡**（spec 167）——
 * 在此之前它們以裸的 `nodeType` 當鍵，於是 `for_statement`／`if_statement`
 * 這些**與 tree-sitter-python 同名**的節點也被接走了，
 * 而它們不經過 `PatternLifter`，**文法過濾看不到它們**。
 *
 * > **一條繞過過濾器的路，會讓過濾器的報告變成一份「它看得到的範圍內」的報告。**
 */
export function registerCppLifters(lifter: Lifter, registries?: CppRegistries): void {
  lifter.registerFor('tree-sitter-cpp', () => registerCppLiftersInner(lifter, registries))
}

function registerCppLiftersInner(lifter: Lifter, registries?: CppRegistries): void {
  // 🔴 **獨立區塊的身分**（spec 155）——原本是 `core/lift/lifter.ts` 直接
  //    import `components/cpp/block/lift`，那是**核心 import 了一顆 C++ 元件**。
  //    🟢 放在這裡，兩個組裝點（產品的 `app.ts` 與測試的 `createTestLifter`）
  //    **自動都有**——它們都呼叫這一支。
  declareStandaloneBlockBuilder(buildBlock)
  // Register C++ transforms (Layer 2)
  if (registries?.transformRegistry) {
    registerCppTransforms(registries.transformRegistry)
  }

  // Register C++ lift strategies (Layer 3)
  const strategyTable = registries?.liftStrategyRegistry
  if (strategyTable) {
    registerCppLiftStrategies(strategyTable)
    // 膠囊的具名辨識策略（`lift-strategy.ts`）——與 `lift.ts` 是不同的登錄表
    for (const reg of componentLiftStrategyRegistrars())
      (reg as (r: typeof strategyTable) => void)(strategyTable)
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
      return buildUsingNamespace(match[1])
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
    return buildDefine(name, value)
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
    // 指令 → 身分由膠囊登錄（`core/component/qualifier-components.ts`）。
    // 這裡只認語法：開頭是不是 `#ifndef`。
    const command = node.text.trimStart().startsWith('#ifndef') ? 'ifndef' : 'ifdef'
    const component = qualifierComponent(command)
    if (!component) return null
    // ⚠️ 原本寫 `{ condition: name, name }`——**同一個值兩個名字**，
    // 而執行器對應地寫著 `properties.condition ?? properties.name`。
    // 兩個名字不是相容層，是重複：沒有任何情境只有其中一個。已收斂成 `condition`。
    return createNode(component, { condition: name }, { body })
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
    const component2 = qualifierComponent('ifndef')
    if (!component2) return null
    return createNode(component2, { condition: name }, { body })
  })
}
