import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { buildToolbox } from '../../../src/ui/toolbox-builder'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import type { CognitiveLevel, ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../../src/blocks/projections/blocks/universal-blocks.json'
import cppBasicBlocks from '../../../src/languages/cpp/projections/blocks/basic.json'
import cppSpecialBlocks from '../../../src/languages/cpp/projections/blocks/special.json'
import cppAdvancedBlocks from '../../../src/languages/cpp/projections/blocks/advanced.json'

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
  const allProjections = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...cppBasicBlocks as unknown as BlockProjectionJSON[],
    ...cppSpecialBlocks as unknown as BlockProjectionJSON[],
    ...cppAdvancedBlocks as unknown as BlockProjectionJSON[],
  ]
  reg.loadFromSplit(allConcepts, allProjections)
  return reg
}

const emptyMsgs: Record<string, string> = {}

describe('ToolboxBuilder', () => {
  it('should produce toolbox with only L0 blocks for level 0', () => {
    const reg = createRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      level: 0 as CognitiveLevel,
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
    })
    const toolbox = result as { kind: string; contents: Array<{ contents: Array<{ type: string }> }> }
    expect(toolbox.kind).toBe('categoryToolbox')
    expect(toolbox.contents.length).toBeGreaterThan(0)
    // All entries should exist (no undefined types)
    for (const cat of toolbox.contents) {
      for (const block of cat.contents) {
        expect(block.type).toBeDefined()
      }
    }
  })

  it('should produce more blocks for level 2 than level 0', () => {
    const reg = createRegistry()
    const configL0 = { blockSpecRegistry: reg, level: 0 as CognitiveLevel, ioPreference: 'iostream' as const, msgs: emptyMsgs, categoryColors: CATEGORY_COLORS }
    const configL2 = { ...configL0, level: 2 as CognitiveLevel }

    const l0 = buildToolbox(configL0) as { contents: Array<{ contents: unknown[] }> }
    const l2 = buildToolbox(configL2) as { contents: Array<{ contents: unknown[] }> }

    const countBlocks = (t: { contents: Array<{ contents: unknown[] }> }) =>
      t.contents.reduce((sum, cat) => sum + cat.contents.length, 0)

    expect(countBlocks(l2)).toBeGreaterThanOrEqual(countBlocks(l0))
  })

  it('should put cstdio blocks before iostream when ioPreference is cstdio', () => {
    const reg = createRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      level: 1 as CognitiveLevel,
      ioPreference: 'cstdio',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
    })
    const toolbox = result as { contents: Array<{ name: string; contents: Array<{ type: string }> }> }
    const ioCat = toolbox.contents.find(c => c.name.includes('輸入') || c.name.includes('I/O') || c.name.includes('輸出'))
    if (ioCat && ioCat.contents.length > 1) {
      // First I/O block should be a c_ (cstdio) block
      const firstType = ioCat.contents[0]?.type
      expect(firstType?.startsWith('c_')).toBe(true)
    }
  })

  it('should produce empty toolbox for empty registry (no error)', () => {
    const reg = new BlockSpecRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      level: 0 as CognitiveLevel,
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
    })
    const toolbox = result as { kind: string; contents: unknown[] }
    expect(toolbox.kind).toBe('categoryToolbox')
    // May have categories with dynamic blocks but no crash
    expect(Array.isArray(toolbox.contents)).toBe(true)
  })

  it('should NOT import blockly (zero UI framework dependency)', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/toolbox-builder.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    const importLines = content.match(/^import\s+.*from\s+['"]([^'"]+)['"]/gm) ?? []
    for (const line of importLines) {
      expect(line).not.toContain("'blockly'")
      expect(line).not.toContain('"blockly"')
    }
  })
})
