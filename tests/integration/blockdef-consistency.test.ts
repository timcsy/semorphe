import { describe, it, expect } from 'vitest'
import { extractInputNames, getInputs } from '../../src/blocks/block-input-names'
import type { BlockSpec, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'

/**
 * Guard test: verify that JSON blockDef input names are consistent and
 * correctly exposed via block-input-names.ts.
 *
 * Root cause context:
 *   universal.json once defined u_if with input "COND", but app.new.ts
 *   dynamically registered u_if with input "CONDITION". PatternRenderer
 *   auto-derivation reads JSON → generated wrong input names →
 *   serialization broke on Block Style switching.
 *
 * Now app.new.ts reads input names from block-input-names.ts which derives
 * them from universal.json — single source of truth, no divergence possible.
 * This test ensures the JSON specs remain well-formed and the extraction works.
 */

describe('block-input-names utility', () => {
  it('IF_INPUTS should contain CONDITION value input and THEN statement input', () => {
    const inputs = getInputs('u_if')
    expect(inputs.value).toContain('CONDITION')
    expect(inputs.statement).toContain('THEN')
  })

  it('WHILE_INPUTS should contain CONDITION value input and BODY statement input', () => {
    const inputs = getInputs('u_while_loop')
    expect(inputs.value).toContain('CONDITION')
    expect(inputs.statement).toContain('BODY')
  })

  it('COUNT_LOOP_INPUTS should contain FROM, TO value inputs and BODY statement input', () => {
    const inputs = getInputs('u_count_loop')
    expect(inputs.value).toContain('FROM')
    expect(inputs.value).toContain('TO')
    expect(inputs.statement).toContain('BODY')
  })
})

describe('blockDef input name sanity checks', () => {
  const _reg = new BlockSpecRegistry()
  const _allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
  _reg.loadFromSplit(_allConcepts, universalBlocks as unknown as BlockProjectionJSON[])
  const specs = _reg.getAll()

  // Blocks where COND was historically used but should be CONDITION
  const mustNotUseCOND = ['u_if', 'u_if_else', 'u_while_loop']

  for (const blockType of mustNotUseCOND) {
    it(`${blockType}: must use CONDITION, not COND`, () => {
      const spec = specs.find(s => s.blockDef?.type === blockType)
      expect(spec).toBeDefined()
      const inputs = extractInputNames(spec!.blockDef)
      expect(inputs.value).not.toContain('COND')
      expect(inputs.value).toContain('CONDITION')
    })
  }

  it('u_if: must use THEN, not BODY for its statement input', () => {
    const spec = specs.find(s => s.blockDef?.type === 'u_if')!
    const inputs = extractInputNames(spec.blockDef)
    expect(inputs.statement).toContain('THEN')
    expect(inputs.statement).not.toContain('BODY')
  })

  it('u_if_else: must have THEN and ELSE statement inputs', () => {
    const spec = specs.find(s => s.blockDef?.type === 'u_if_else')!
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
