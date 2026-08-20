/**
 * Full Block Roundtrip Test (T054)
 *
 * Verifies that ALL blocks (68 total) can complete:
 * 1. Semantic→Block render (PatternRenderer)
 * 2. Block→Semantic extract (PatternExtractor)
 * 3. Code generation (TemplateGenerator)
 *
 * This is the completeness validation for the JSON-driven pipeline.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { createNode } from '../../src/core/semantic-tree'
import type { BlockSpec, UniversalTemplate, ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'

import { universalConcepts, universalBlocks } from '../../src/core/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'

// Build allSpecs eagerly at module level (needed for describe-time iteration)
const _registry = new BlockSpecRegistry()
const _allConcepts = allCppConcepts()
const _allProjections = allCppProjections()
_registry.loadFromSplit(_allConcepts, _allProjections)
const allSpecs: BlockSpec[] = _registry.getAll()

let renderer: PatternRenderer
let extractor: PatternExtractor
let generator: TemplateGenerator

beforeAll(() => {
  renderer = new PatternRenderer()
  extractor = new PatternExtractor()
  generator = new TemplateGenerator()

  renderer.loadBlockSpecs(allSpecs)
  extractor.loadBlockSpecs(allSpecs)

  for (const spec of allSpecs) {
    if (spec.codeTemplate?.pattern && spec.componentMapping?.componentId) {
      generator.registerTemplate(spec.componentMapping.componentId, spec.codeTemplate)
    }
  }
  generator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])
})

/**
 * Build a minimal SemanticNode with dummy values for all properties and children
 * based on the block's concept definition.
 */
function buildDummyNode(spec: BlockSpec) {
  const concept = spec.componentMapping!
  const props: Record<string, string> = {}
  const children: Record<string, any[]> = {}

  for (const prop of concept.properties ?? []) {
    props[prop] = 'test'
  }

  const childDefs = concept.children ?? {}
  // children can be array of objects or a plain object
  if (Array.isArray(childDefs)) {
    for (const childObj of childDefs) {
      for (const [name, role] of Object.entries(childObj)) {
        if (role === 'statements') {
          children[name] = [] // empty statement list
        } else {
          children[name] = [createNode('cpp:literal_number', { value: '0' })]
        }
      }
    }
  } else {
    for (const [name, role] of Object.entries(childDefs)) {
      if (role === 'statements') {
        children[name] = []
      } else {
        children[name] = [createNode('cpp:literal_number', { value: '0' })]
      }
    }
  }

  return createNode(concept.componentId, props, children)
}

describe('Full Roundtrip — All 68 Blocks', () => {
  // Skip blocks that are raw/unresolved (no real concept mapping)
  const skipConcepts = new Set(['cpp:raw_code', 'cpp:raw_expression'])

  describe('Render coverage: every concept renders to correct block type', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipConcepts.has(componentId)) continue

      const blockType = (spec.blockDef as any).type
      const form = (spec as { form?: { axis: string; value: string } }).form

      it(`${componentId} → ${blockType}`, () => {
        const sem = buildDummyNode(spec)
        // ⚠️ **多形態之後這個不變式要改**（097）。
        //
        // 一個元件身分現在可以有多個積木形態，而合成節點**沒有選擇軸需要的
        // 屬性**（例如容器種類）——所以它渲染出來的是**中性形態**，不是變體。
        //
        // 這不是退步：變體要在有脈絡時才選得出來，而「有脈絡時選對」由
        // `multi-form-container.test.ts` 驗。這裡驗的是「渲染得出來、而且
        // 渲染出來的是這個身分宣告過的某個形態」。
        // ⚠️ **兩種軸要分開處理**（B 項之後）。
        //
        // `container_kind` 這類軸讀的是**節點屬性**——放進去就選得到。
        // 而 `role` 軸讀的是**呈現位置**，而 `render()` 是敘述路徑、不帶位置
        // ——所以 role 變體在這裡選不到，會落到中性形態。**那是對的**：
        // 位置由呼叫端說，運算式位置走 `renderExpression`（另有測試驗）。
        if (form && form.axis !== 'role') sem.properties[form.axis] = form.value
        const block = renderer.render(sem)
        expect(block, `Failed to render concept '${componentId}'`).not.toBeNull()
        if (form?.axis === 'role') {
          // 只驗「渲染得出來、而且是這個身分宣告過的某個形態」
          const allForms = allSpecs
            .filter((s) => s.componentMapping?.componentId === componentId)
            .map((s) => (s.blockDef as any).type)
          expect(allForms).toContain(block!.type)
        } else {
          expect(block!.type).toBe(blockType)
        }
      })
    }
  })

  describe('Extract coverage: every block extracts to correct concept', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipConcepts.has(componentId)) continue

      const blockType = (spec.blockDef as any).type

      it(`${blockType} → ${componentId}`, () => {
        const sem = buildDummyNode(spec)
        const block = renderer.render(sem)
        expect(block).not.toBeNull()

        const extracted = extractor.extract(block!)
        expect(extracted, `Failed to extract block '${blockType}'`).not.toBeNull()
        expect(extracted!.componentId).toBe(componentId)
      })
    }
  })

  describe('Code generation coverage: every concept generates code', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipConcepts.has(componentId)) continue
      if (!spec.codeTemplate?.pattern) continue // skip blocks without templates

      it(`${componentId} generates code`, () => {
        const sem = buildDummyNode(spec)
        const code = generator.generate(sem, { indent: 0, style: { indent_size: 4 } as any })
        expect(code, `Failed to generate code for '${componentId}'`).not.toBeNull()
        expect(typeof code).toBe('string')
      })
    }
  })
})
