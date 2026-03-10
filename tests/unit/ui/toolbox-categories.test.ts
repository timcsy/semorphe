/**
 * TDD tests for Phase C Item 3: CATEGORY_DEFS → language module
 *
 * After refactoring, category definitions should come from a language module
 * rather than being hardcoded in toolbox-builder.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { cppCategoryDefs, buildIoCategoryContents } from '../../../src/languages/cpp/toolbox-categories'
import { buildToolbox, type ToolboxCategoryDef } from '../../../src/ui/toolbox-builder'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import type { CognitiveLevel, ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
import { setBlockSpecRegistry } from '../../../src/core/cognitive-levels'

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
  const allProjections = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...coreBlocks,
    ...allStdModules.flatMap(m => m.blocks),
  ]
  reg.loadFromSplit(allConcepts, allProjections)
  setBlockSpecRegistry(reg)
  return reg
}

describe('C++ toolbox categories (language module)', () => {
  it('cppCategoryDefs has expected categories', () => {
    const keys = cppCategoryDefs.map(d => d.key)
    expect(keys).toContain('data')
    expect(keys).toContain('operators')
    expect(keys).toContain('control')
    expect(keys).toContain('functions')
    expect(keys).toContain('arrays')
    expect(keys).toContain('io')
    expect(keys).toContain('cpp_basic')
    expect(keys).toContain('cpp_special')
  })

  it('each category has required properties', () => {
    for (const def of cppCategoryDefs) {
      expect(def.key).toBeDefined()
      expect(def.nameKey).toBeDefined()
      expect(def.fallback).toBeDefined()
      expect(def.colorKey).toBeDefined()
      expect(def.registryCategories).toBeInstanceOf(Array)
    }
  })

  it('buildIoCategoryContents sorts iostream first for iostream pref', () => {
    const reg = createRegistry()
    const contents = buildIoCategoryContents(reg, 2 as CognitiveLevel, 'iostream')
    const types = contents.map(c => c.type)
    // iostream types (u_*) should come before cstdio types (c_*)
    const firstCIdx = types.findIndex(t => t.startsWith('c_'))
    const lastUIdx = types.length - 1 - [...types].reverse().findIndex(t => t.startsWith('u_'))
    if (firstCIdx >= 0 && lastUIdx >= 0) {
      expect(firstCIdx).toBeGreaterThan(lastUIdx)
    }
  })

  it('buildToolbox accepts external categoryDefs', () => {
    const reg = createRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      level: 2 as CognitiveLevel,
      ioPreference: 'iostream',
      msgs: {},
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { kind: string; contents: Array<{ name: string; contents: unknown[] }> }
    expect(toolbox.kind).toBe('categoryToolbox')
    expect(toolbox.contents.length).toBeGreaterThan(0)
  })
})
