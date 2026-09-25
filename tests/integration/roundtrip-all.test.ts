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
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'

import { universalComponents, universalBlocks } from '../../src/core/universal'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/lang'
import { allStdModules } from '../../src/languages/cpp/std'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalComponents ＋ coreComponents ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppComponents()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'

// Build allSpecs eagerly at module level (needed for describe-time iteration)
const _registry = new BlockSpecRegistry()
const _allComponents = allCppComponents()
const _allProjections = allCppProjections()
_registry.loadFromSplit(_allComponents, _allProjections)
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
 * Build a minimal SemanticNode with dummy values for all properties and slots
 * based on the block's component definition.
 */
function buildDummyNode(spec: BlockSpec) {
  const component = spec.componentMapping!
  const props: Record<string, string> = {}
  const slots: Record<string, any[]> = {}

  for (const prop of component.properties ?? []) {
    props[prop] = 'test'
  }

  const childDefs = component.slots ?? {}
  // slots can be array of objects or a plain object
  if (Array.isArray(childDefs)) {
    for (const childObj of childDefs) {
      for (const [name, role] of Object.entries(childObj)) {
        if (role === 'statements') {
          slots[name] = [] // empty statement list
        } else {
          slots[name] = [createNode('cpp:literal_number', { value: '0' })]
        }
      }
    }
  } else {
    for (const [name, role] of Object.entries(childDefs)) {
      if (role === 'statements') {
        slots[name] = []
      } else {
        slots[name] = [createNode('cpp:literal_number', { value: '0' })]
      }
    }
  }

  return createNode(component.componentId, props, slots)
}

describe('Full Roundtrip — All 68 Blocks', () => {
  // Skip blocks that are raw/unresolved (no real component mapping)
  const skipComponents = new Set(['cpp:raw_code', 'cpp:raw_expression'])

  describe('Render coverage: every component renders to correct block type', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipComponents.has(componentId)) continue

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
        // 🔴 **第三次了：一條「處理變體」的規則只認得一種變體**（2026-09-25）。
        //
        //    上面那兩段註解記著它被改過兩次（097 多形態、B 項的兩種軸）。
        //    這一次是**導出的組合形態**（`forms`，一次帶好幾條軸）——而它的
        //    `form` 是 `undefined`，於是這裡把它當成【中性】，嚴格比對就紅了。
        //
        // > **一條「處理變體」的規則，每出現一種新的變體種類就要被改一次
        // > ——而它每次都是【安靜地】把新的那種當成中性。**
        //
        //    同一天同一刀裡這個形狀出現三次：`spec.id` 的鍵、`neutralFirst`
        //    的排序、以及這裡。
        const axisPairs = form ? [form] : ((spec as { forms?: { axis: string; value: string }[] }).forms ?? [])
        const hasRoleAxis = axisPairs.some((a) => a.axis === 'role')
        for (const a of axisPairs) if (a.axis !== 'role') sem.properties[a.axis] = a.value
        const block = renderer.render(sem)
        expect(block, `Failed to render component '${componentId}'`).not.toBeNull()
        if (hasRoleAxis) {
          // 只驗「渲染得出來、而且是這個身分宣告過的某個形態」
          //
          // ⚠️ 組合形態（例如 `_stack_expression`）在這裡**本來就選不到**：
          // `render()` 是敘述路徑，而那顆組合要的是**運算式位置**。
          // 它會落到 `_stack`——**那是對的**，位置由呼叫端說。
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

  describe('Extract coverage: every block extracts to correct component', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipComponents.has(componentId)) continue

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

  describe('Code generation coverage: every component generates code', () => {
    for (const spec of allSpecs) {
      const componentId = spec.componentMapping?.componentId
      if (!componentId || skipComponents.has(componentId)) continue
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
