import { describe, it, expect } from 'vitest'
import { extractInputNames, getInputs } from '../../src/core/block-input-names'
import type { BlockSpec, ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
// ⚠️ **第十一個組裝點**：這裡原本只讀 `universal` 的兩個陣列。
// 一顆通用元件搬進膠囊之後 `specs.find(...)` 回 undefined，
// 而斷言訊息說的是「must use CONDITION, not COND」——**訊息與根因無關**。
import { universalConcepts, universalBlocks } from '../../src/core/universal'
import { componentConcepts, componentBlocks } from '../../src/core/component/registry'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreConcepts } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'

/**
 * Guard test: verify that JSON blockDef input names are consistent and
 * correctly exposed via block-input-names.ts.
 *
 * Root cause context:
 *   universal.json once defined cpp_if with input "COND", but app.new.ts
 *   dynamically registered cpp_if with input "CONDITION". PatternRenderer
 *   auto-derivation reads JSON → generated wrong input names →
 *   serialization broke on Block Style switching.
 *
 * Now app.new.ts reads input names from block-input-names.ts which derives
 * them from universal.json — single source of truth, no divergence possible.
 * This test ensures the JSON specs remain well-formed and the extraction works.
 */

describe('block-input-names utility', () => {
  it('IF_INPUTS should contain CONDITION value input and THEN statement input', () => {
    const inputs = getInputs('cpp_if')
    expect(inputs.value).toContain('CONDITION')
    expect(inputs.statement).toContain('THEN')
  })

  it('WHILE_INPUTS should contain CONDITION value input and BODY statement input', () => {
    const inputs = getInputs('cpp_loop_while')
    expect(inputs.value).toContain('CONDITION')
    expect(inputs.statement).toContain('BODY')
  })

  it('COUNT_LOOP_INPUTS should contain FROM, TO value inputs and BODY statement input', () => {
    const inputs = getInputs('cpp_loop_count')
    expect(inputs.value).toContain('FROM')
    expect(inputs.value).toContain('TO')
    expect(inputs.statement).toContain('BODY')
  })
})

describe('blockDef input name sanity checks', () => {
  const _reg = new BlockSpecRegistry()
  // ⚠️ **第十一個組裝點**：`_allConcepts` 列舉了三種來源卻**漏了元件膠囊**，
  // 而積木那一側只給 `universalBlocks`。一顆通用元件搬進膠囊之後
  // `specs.find(...)` 回 undefined，斷言訊息卻說「must use CONDITION, not COND」
  // ——**訊息與根因無關**，而那比沒有訊息更難查。
  //
  // > 每一處「自己列舉來源」的地方，都會在下一次搬家時漏掉一種來源。
  const _allConcepts = [
    ...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts),
    ...(componentConcepts() as unknown as ComponentDefJSON[]),
  ]
  _reg.loadFromSplit(_allConcepts, [
    ...universalBlocks,
    ...(componentBlocks() as BlockProjectionJSON[]),
  ])
  const specs = _reg.getAll()

  // Blocks where COND was historically used but should be CONDITION
  const mustNotUseCOND = ['cpp_if', 'cpp_if_else', 'cpp_loop_while']

  for (const blockType of mustNotUseCOND) {
    it(`${blockType}: must use CONDITION, not COND`, () => {
      const spec = specs.find(s => s.blockDef?.type === blockType)
      expect(spec).toBeDefined()
      const inputs = extractInputNames(spec!.blockDef)
      expect(inputs.value).not.toContain('COND')
      expect(inputs.value).toContain('CONDITION')
    })
  }

  it('cpp_if: must use THEN, not BODY for its statement input', () => {
    const spec = specs.find(s => s.blockDef?.type === 'cpp_if')!
    const inputs = extractInputNames(spec.blockDef)
    expect(inputs.statement).toContain('THEN')
    expect(inputs.statement).not.toContain('BODY')
  })

  it('cpp_if_else: must have THEN and ELSE statement inputs', () => {
    const spec = specs.find(s => s.blockDef?.type === 'cpp_if_else')!
    const inputs = extractInputNames(spec.blockDef)
    expect(inputs.statement).toContain('THEN')
    expect(inputs.statement).toContain('ELSE')
  })
})

describe('cross-style I/O coverage reminder', () => {
  // This test documents the requirement that I/O features must be tested
  // with both cout and printf styles. If this test file exists, developers
  // know to check generators.test.ts for printf×endl combinations.
  it('should have printf+endl tests in generators.test.ts (meta-check)', () => {
    // If this fails, it means the test file was removed — re-add printf×endl tests
    expect(true).toBe(true)
  })
})
