import { describe, it, expect } from 'vitest'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { universalConcepts, universalBlocks } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import algorithmBlocks from '../../src/languages/cpp/std/algorithm/blocks.json'
// ⚠️ `cpp:vector_declare` 已元件化，不在這個模組檔裡了——走唯一組裝點。
import { allCppProjections } from '../../src/languages/cpp/all-declarations'

// `<vector>` 模組的積木 ＋ 已元件化的那幾顆。原本直接讀模組的 blocks.json，
// 而 `cpp:vector_declare` 搬進膠囊之後那個檔就少了一筆。
const containerBlocks = allCppProjections().filter(
  (b) => (b as { owner?: string }).owner === '<vector>',
)

const allConcepts = [
  ...universalConcepts,
  ...coreConcepts,
  ...allStdModules.flatMap(m => m.concepts),
]

describe('JSON-only extension (US6)', () => {
  it('should load algorithm block specs from JSON', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, algorithmBlocks as unknown as BlockProjectionJSON[])
    const all = registry.getAll()
    expect(all.length).toBe(6)
    expect(all.map(s => s.id)).toContain('cpp:range_sort')
    expect(all.map(s => s.id)).toContain('cpp:range_reverse')
    expect(all.map(s => s.id)).toContain('cpp:range_fill')
    expect(all.map(s => s.id)).toContain('cpp:math_min')
    expect(all.map(s => s.id)).toContain('cpp:math_max')
    expect(all.map(s => s.id)).toContain('cpp:var_swap')
  })

  it('should load container block specs from JSON', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, containerBlocks as unknown as BlockProjectionJSON[])
    const all = registry.getAll()
    expect(all.length).toBe(4)
    expect(all.map(s => s.id)).toContain('cpp:vector_declare')
    expect(all.map(s => s.id)).toContain('cpp:vector_size')
    expect(all.map(s => s.id)).toContain('cpp:vector_pop')
    expect(all.map(s => s.id)).toContain('cpp:vector_back')
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

  it('should have valid block definitions', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromSplit(allConcepts, algorithmBlocks as unknown as BlockProjectionJSON[])
    for (const spec of registry.getAll()) {
      // Algorithm blocks use hand-written generators, so codeTemplate may be empty
      // Just verify blockDef is valid
      expect(spec.blockDef).toBeTruthy()
      expect((spec.blockDef as Record<string, unknown>).type).toBeTruthy()
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
      ...universalBlocks,
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
    const sortSpec = registry.getAll().find(s => s.id === 'cpp:range_sort')
    expect(sortSpec).toBeDefined()
    expect(sortSpec!.conceptMapping.conceptId).toBe('cpp:range_sort')
    // 原本斷言的是 'sort'——而那個概念**從來不存在**，查詢父概念會靜默回傳
    // undefined。這支測試等於在釘住一個懸空指標。
    // cpp_sort 目前沒有語言中立的父概念（通用概念集裡沒有「排序」這個抽象），
    // 所以正確的值是「沒有」。見 specs/056-abstract-concept-integrity。
    expect(sortSpec!.conceptMapping.abstractConcept ?? null).toBeNull()

    const backSpec = registry.getAll().find(s => s.id === 'cpp:vector_back')
    // 同上：'vector_back' 這個概念從來不存在
    expect(backSpec!.conceptMapping.abstractConcept ?? null).toBeNull()
  })
})
