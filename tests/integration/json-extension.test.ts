import { describe, it, expect } from 'vitest'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import algorithmBlocks from '../../src/languages/cpp/std/algorithm/blocks.json'
import containerBlocks from '../../src/languages/cpp/std/vector/blocks.json'

const allConcepts = [
  ...universalConcepts as unknown as ConceptDefJSON[],
  ...coreConcepts,
  ...allStdModules.flatMap(m => m.concepts),
]

describe('JSON-only extension (US6)', () => {
  it('should load algorithm block specs from JSON', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, algorithmBlocks as unknown as BlockProjectionJSON[])
    const all = registry.getAll()
    expect(all.length).toBe(2)
    expect(all.map(s => s.id)).toContain('cpp_sort')
    expect(all.map(s => s.id)).toContain('cpp_find')
  })

  it('should load container block specs from JSON', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, containerBlocks as unknown as BlockProjectionJSON[])
    const all = registry.getAll()
    expect(all.length).toBe(7)
    expect(all.map(s => s.id)).toContain('cpp_vector_declare')
    expect(all.map(s => s.id)).toContain('cpp_vector_push_back')
    expect(all.map(s => s.id)).toContain('cpp_vector_size')
    expect(all.map(s => s.id)).toContain('cpp_vector_pop_back')
    expect(all.map(s => s.id)).toContain('cpp_vector_clear')
    expect(all.map(s => s.id)).toContain('cpp_vector_empty')
    expect(all.map(s => s.id)).toContain('cpp_vector_back')
  })

  it('should have valid blockDef with type field', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, [
      ...algorithmBlocks as unknown as BlockProjectionJSON[],
      ...containerBlocks as unknown as BlockProjectionJSON[],
    ])
    for (const spec of registry.getAll()) {
      const blockDef = spec.blockDef as Record<string, unknown>
      expect(blockDef.type).toBeTruthy()
      expect(typeof blockDef.type).toBe('string')
    }
  })

  it('should have codeTemplate with pattern', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, algorithmBlocks as unknown as BlockProjectionJSON[])
    for (const spec of registry.getAll()) {
      expect(spec.codeTemplate.pattern).toBeTruthy()
      expect(spec.codeTemplate.imports).toBeDefined()
    }
  })

  it('should have astPattern for lifting', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, algorithmBlocks as unknown as BlockProjectionJSON[])
    for (const spec of registry.getAll()) {
      expect(spec.astPattern.nodeType).toBeTruthy()
    }
  })

  it('should coexist with universal blocks without conflicts', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, [
      ...universalBlocks as unknown as BlockProjectionJSON[],
      ...algorithmBlocks as unknown as BlockProjectionJSON[],
      ...containerBlocks as unknown as BlockProjectionJSON[],
    ])
    const all = registry.getAll()
    expect(all.length).toBeGreaterThan(4)
    const ids = all.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should have concept mapping with abstractConcept', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, [
      ...algorithmBlocks as unknown as BlockProjectionJSON[],
      ...containerBlocks as unknown as BlockProjectionJSON[],
    ])
    const sortSpec = registry.getAll().find(s => s.id === 'cpp_sort')
    expect(sortSpec).toBeDefined()
    expect(sortSpec!.concept.conceptId).toBe('cpp_sort')
    expect(sortSpec!.concept.abstractConcept).toBe('sort')

    const pushBackSpec = registry.getAll().find(s => s.id === 'cpp_vector_push_back')
    expect(pushBackSpec!.concept.abstractConcept).toBe('vector_push_back')
  })
})
