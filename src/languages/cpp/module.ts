/**
 * C++ Language Module
 *
 * Central initialization for the JSON-driven conversion pipeline.
 * Loads concept definitions (semantic layer) and block projections (projection layer)
 * directly into registries, then wires into the four generic engines.
 */
import type { LiftPattern, UniversalTemplate, ConceptDefJSON, BlockProjectionJSON } from '../../core/types'
import { BlockSpecRegistry } from '../../core/block-spec-registry'
import { ConceptRegistry } from '../../core/concept-registry'
import { PatternLifter } from '../../core/lift/pattern-lifter'
import { TemplateGenerator } from '../../core/projection/template-generator'
import { PatternRenderer } from '../../core/projection/pattern-renderer'
import { PatternExtractor } from '../../core/projection/pattern-extractor'

// Semantic layer: concept definitions
import { universalConcepts } from '../../core/universal'
import { declareNonComponent } from '../../core/non-components'
import { allCppProjections } from './all-declarations'
import { coreConcepts } from './core'
import { allStdModules } from './std'
import { componentConcepts } from '../../core/component/registry'

// Projection layer: block definitions

// Other resources
import liftPatternsJson from './lift-patterns.json'
import universalTemplatesJson from './templates/universal-templates.json'

export interface CppModuleEngines {
  registry: BlockSpecRegistry
  conceptRegistry: ConceptRegistry
  patternLifter: PatternLifter
  templateGenerator: TemplateGenerator
  patternRenderer: PatternRenderer
  patternExtractor: PatternExtractor
}

/**
 * Initialize the C++ language module with all four engines.
 * Returns the initialized engines for wiring into the app.
 */
/**
 * C++ 套件裡**不是元件**的樹節點。
 *
 * 它們沒有概念定義是**刻意的**，而在此之前那與「忘了寫定義」分不出來——
 * 兩者都只是「不在登錄表裡」。見 `src/core/non-components.ts` 的檔頭。
 */
declareNonComponent(
  'param_decl',
  'structural',
  '函式參數的結構化節點（`{type, name}`）。它是 `func_def` 的子節點，不會單獨成為一顆積木；' +
    '把它做成元件會多出一顆只有一路的殼。⚠️ C1（參數規格化）可能把它升級成 ParamSpec 的一部分。',
)
// ⚠️ ~~`cpp_initializer_list` 曾在這裡宣告成 structural~~
// **2026-08-14 升格成元件** `cpp:initializer_list`。原本的理由逐字是
// 「它是宣告的子節點、不獨立存在」，而那句話**只對辨識那一路成立**：
// 積木那一路需要它獨立存在，否則多維初始值表達不出來（`{{1,2},{3,4}}` 要巢狀）。
// 🔴 症狀是使用者開瀏覽器才發現的——積木上沒有初始值，一動就掉。
declareNonComponent(
  '_compound',
  'sentinel',
  '辨識過程的中間產物：pattern 匹配到多個節點時的暫時包裝，攤平後就消失，不會進入最終語義樹。',
)
declareNonComponent(
  '_multi_field',
  'sentinel',
  '同上——一次宣告多個結構成員時的暫時包裝。底線前綴是慣例，而**判準是這份宣告，不是前綴**。',
)

export function initCppModule(): CppModuleEngines {
  const registry = new BlockSpecRegistry()
  const conceptRegistry = new ConceptRegistry()
  const patternLifter = new PatternLifter()
  const templateGenerator = new TemplateGenerator()
  const patternRenderer = new PatternRenderer()
  const patternExtractor = new PatternExtractor()

  // 1. Load concepts into ConceptRegistry (semantic layer, independent of Blockly)
  const allConcepts: ConceptDefJSON[] = [
    ...universalConcepts as unknown as ConceptDefJSON[],
    ...coreConcepts,
    ...allStdModules.flatMap(m => m.concepts),
    ...(componentConcepts() as unknown as ConceptDefJSON[]),
  ]
  conceptRegistry.loadFromJSON(allConcepts)

  // 2. Load split JSON directly into registry
  const allProjections: BlockProjectionJSON[] = allCppProjections()
  registry.loadFromSplit(allConcepts, allProjections)
  const allSpecs = registry.getAll()

  // 3. Load block specs into engines
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression', 'preproc_ifdef'])
  patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
  patternRenderer.loadBlockSpecs(allSpecs)
  patternExtractor.loadBlockSpecs(allSpecs)

  // 4. Load lift patterns
  patternLifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])

  // 5. Load universal templates
  templateGenerator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])

  // 6. Register code templates from block specs
  for (const spec of allSpecs) {
    if (spec.codeTemplate && spec.conceptMapping?.conceptId) {
      // ⚠️ **只註冊中性形態的模板。**
      //
      // 一個元件身分現在可以有多個積木形態（097），而模板索引是
      // `conceptId → 模板` 的一對一。變體也註冊的話，後來的會蓋掉中性版
      // ——實測後果是 `v.push_back(5);` 少了分號（拿到運算式版的模板）。
      //
      // 位置的差別由產生器的 `ctx.isExpression` 表達，不由模板分岔。
      templateGenerator.registerTemplate(
        spec.conceptMapping.conceptId,
        spec.codeTemplate,
        (spec as { form?: { axis: string; value: string } }).form,
      )
    }
  }

  return { registry, conceptRegistry, patternLifter, templateGenerator, patternRenderer, patternExtractor }
}
