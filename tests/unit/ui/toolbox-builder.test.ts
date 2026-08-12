import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { buildToolbox } from '../../../src/ui/toolbox-builder'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import type { ConceptDefJSON, BlockProjectionJSON, Topic } from '../../../src/core/types'
import { getVisibleConcepts } from '../../../src/core/level-tree'
// ⚠️ 走蓋過 owner 章的匯出，不要直接 import 原始 JSON——
// 工具箱靠 owner 決定歸屬，少了它整個通用分類會是空的。
import { universalConcepts, universalBlocks } from '../../../src/core/universal'
import { coreConcepts, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
import { cppCategoryDefs } from '../../../src/languages/cpp/toolbox-categories'
import cppBeginnerTopic from '../../../src/languages/cpp/topics/cpp-beginner.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../../src/languages/cpp/all-declarations'

const topic = cppBeginnerTopic as Topic

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allConcepts = allCppConcepts()
  const allProjections = allCppProjections()
  reg.loadFromSplit(allConcepts, allProjections)
  return reg
}

const emptyMsgs: Record<string, string> = {}

describe('ToolboxBuilder', () => {
  it('should produce toolbox with only root-level blocks', () => {
    const reg = createRegistry()
    const visibleConcepts = getVisibleConcepts(topic, new Set(['L0']))
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts,
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { kind: string; contents: Array<{ contents: Array<{ type: string }> }> }
    expect(toolbox.kind).toBe('categoryToolbox')
    expect(toolbox.contents.length).toBeGreaterThan(0)
    for (const cat of toolbox.contents) {
      for (const block of cat.contents) {
        expect(block.type).toBeDefined()
      }
    }
  })

  it('should produce more blocks for deeper branches', () => {
    const reg = createRegistry()
    const rootOnly = getVisibleConcepts(topic, new Set(['L0']))
    const withL1 = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L1b']))

    const configRoot = { blockSpecRegistry: reg, visibleConcepts: rootOnly, ioPreference: 'iostream' as const, msgs: emptyMsgs, categoryColors: CATEGORY_COLORS, categoryDefs: cppCategoryDefs }
    const configL1 = { ...configRoot, visibleConcepts: withL1 }

    const tRoot = buildToolbox(configRoot) as { contents: Array<{ contents: unknown[] }> }
    const tL1 = buildToolbox(configL1) as { contents: Array<{ contents: unknown[] }> }

    const countBlocks = (t: { contents: Array<{ contents: unknown[] }> }) =>
      t.contents.reduce((sum, cat) => sum + cat.contents.length, 0)

    expect(countBlocks(tL1)).toBeGreaterThan(countBlocks(tRoot))
  })

  it('should put cstdio blocks before iostream when ioPreference is cstdio', () => {
    const reg = createRegistry()
    const allConcepts = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L1b']))
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: allConcepts,
      ioPreference: 'cstdio',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { contents: Array<{ name: string; contents: Array<{ type: string }> }> }
    const ioCat = toolbox.contents.find(c => c.name.includes('輸入') || c.name.includes('I/O') || c.name.includes('輸出'))
    if (ioCat && ioCat.contents.length > 1) {
      // ⚠️ 原本寫 `firstType.startsWith('c_')`——**又是拿形狀當判斷**。
      // 116 之後沒有型別以 `c_` 開頭，這一句會永遠是 false。
      // 要問的是「它是不是語言專屬的」，而那寫在概念宣告的 `layer` 上。
      const firstType = ioCat.contents[0]?.type
      const layer = firstType ? reg.getByBlockType(firstType)?.conceptMapping?.layer : undefined
      expect(layer, `cstdio 偏好時第一顆該是語言專屬的，實得 ${firstType}`).not.toBe('universal')
    }
  })

  it('should produce empty toolbox for empty registry (no error)', () => {
    const reg = new BlockSpecRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: new Set(),
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { kind: string; contents: unknown[] }
    expect(toolbox.kind).toBe('categoryToolbox')
    expect(Array.isArray(toolbox.contents)).toBe(true)
  })

  it('should include cpp_input_expression when input concept is visible', () => {
    const reg = createRegistry()
    const allConcepts = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: allConcepts,
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { contents: Array<{ contents: Array<{ type: string }> }> }
    const allTypes = toolbox.contents.flatMap(c => c.contents.map(b => b.type))
    expect(allTypes).toContain('cpp_input_expression')
  })

  it('toolbox should be monotonically inclusive: root ⊆ root+L1 ⊆ all', () => {
    const reg = createRegistry()
    const getTypes = (branches: Set<string>) => {
      const concepts = getVisibleConcepts(topic, branches)
      const r = buildToolbox({
        blockSpecRegistry: reg,
        visibleConcepts: concepts,
        ioPreference: 'iostream',
        msgs: emptyMsgs,
        categoryColors: CATEGORY_COLORS,
      })
      const toolbox = r as { contents: Array<{ contents: Array<{ type: string }> }> }
      return new Set(toolbox.contents.flatMap(c => c.contents.map(b => b.type)))
    }
    const rootOnly = getTypes(new Set(['L0']))
    const withL1 = getTypes(new Set(['L0', 'L1a', 'L1b']))
    const all = getTypes(new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    for (const t of rootOnly) expect(withL1.has(t), `Root type "${t}" missing from L1`).toBe(true)
    for (const t of withL1) expect(all.has(t), `L1 type "${t}" missing from all`).toBe(true)
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
