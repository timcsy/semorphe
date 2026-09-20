import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { BlockSpecRegistry } from '../../../src/core/blocks/block-spec-registry'
import { buildToolbox } from '../../../src/core/blocks/toolbox-builder'
import { CATEGORY_COLORS } from '../../../src/core/blocks/category-colors'
import type { ComponentDefJSON, BlockProjectionJSON, Topic } from '../../../src/core/types'
import { topicComponents } from '../../../src/core/lesson/topic-components'

/**
 * 取這個主題的前 n 顆——**只是為了造兩個大小不同的可見集合**。
 *
 * 🪦 這裡在 2026-09-20 之前是 `getVisibleComponents(topic, new Set(['L0', …]))`。
 * 層級樹退場之後「可見集合」只有兩個來源（主題的全部／那一課的），
 * 而這幾支測的是 `buildToolbox`「**集合越大，積木越多**」——
 * 它與那個集合**怎麼算出來的**無關。
 *
 * > **一支測「B 隨 A 變大」的測試，不該綁在「A 怎麼算出來」上。**
 */
const firstN = (t: Topic, n: number): Set<string> => new Set([...topicComponents(t)].slice(0, n))
// ⚠️ 走蓋過 owner 章的匯出，不要直接 import 原始 JSON——
// 工具箱靠 owner 決定歸屬，少了它整個通用分類會是空的。
import { universalComponents, universalBlocks } from '../../../src/core/universal'
import { coreComponents, coreBlocks } from '../../../src/languages/cpp/lang'
import { allStdModules } from '../../../src/languages/cpp/std'
import { cppCategoryDefs } from '../../../src/languages/cpp/toolbox-categories'
import cppBeginnerTopic from '../../../src/languages/cpp/topics/cpp-beginner.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalComponents ＋ coreComponents ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppComponents()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppComponents, allCppProjections } from '../../../src/languages/cpp/all-declarations'

const topic = cppBeginnerTopic as Topic

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allComponents = allCppComponents()
  const allProjections = allCppProjections()
  reg.loadFromSplit(allComponents, allProjections)
  return reg
}

const emptyMsgs: Record<string, string> = {}

describe('ToolboxBuilder', () => {
  it('should produce toolbox with only root-level blocks', () => {
    const reg = createRegistry()
    const visibleComponents = firstN(topic, 20)
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents,
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
    const rootOnly = firstN(topic, 20)
    const withL1 = topicComponents(topic)

    const configRoot = { blockSpecRegistry: reg, visibleComponents: rootOnly, ioPreference: 'iostream' as const, msgs: emptyMsgs, categoryColors: CATEGORY_COLORS, categoryDefs: cppCategoryDefs }
    const configL1 = { ...configRoot, visibleComponents: withL1 }

    const tRoot = buildToolbox(configRoot) as { contents: Array<{ contents: unknown[] }> }
    const tL1 = buildToolbox(configL1) as { contents: Array<{ contents: unknown[] }> }

    const countBlocks = (t: { contents: Array<{ contents: unknown[] }> }) =>
      t.contents.reduce((sum, cat) => sum + cat.contents.length, 0)

    expect(countBlocks(tL1)).toBeGreaterThan(countBlocks(tRoot))
  })

  it('should put cstdio blocks before iostream when ioPreference is cstdio', () => {
    const reg = createRegistry()
    const allComponents = topicComponents(topic)
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents: allComponents,
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
      const layer = firstType ? reg.getByBlockType(firstType)?.componentMapping?.layer : undefined
      expect(layer, `cstdio 偏好時第一顆該是語言專屬的，實得 ${firstType}`).not.toBe('universal')
    }
  })

  it('should produce empty toolbox for empty registry (no error)', () => {
    const reg = new BlockSpecRegistry()
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents: new Set(),
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { kind: string; contents: unknown[] }
    expect(toolbox.kind).toBe('categoryToolbox')
    expect(Array.isArray(toolbox.contents)).toBe(true)
  })

  it('should include cpp_input_expression when input component is visible', () => {
    const reg = createRegistry()
    const allComponents = topicComponents(topic)
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents: allComponents,
      ioPreference: 'iostream',
      msgs: emptyMsgs,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
    const toolbox = result as { contents: Array<{ contents: Array<{ type: string }> }> }
    const allTypes = toolbox.contents.flatMap(c => c.contents.map(b => b.type))
    expect(allTypes).toContain('cpp_input_expression')
  })

  /**
   * **可見集合變大，工具箱只准變多**——不准有東西掉出來。
   *
   * 🪦 這一條在 2026-09-20 之前是拿三層分支（`L0` ⊆ `L0+L1` ⊆ 全部）餵的，
   * 而層級樹退場之後**它守的性質一格都沒變**：它問的從來就是
   *「`buildToolbox` 對輸入集合是不是單調的」，不是「層級樹怎麼算」。
   *
   * > **一支測「B 隨 A 單調」的測試，綁在「A 怎麼算出來」上的那一天，
   * > 它會隨著 A 的算法一起死掉——而它要守的東西還活著。**
   */
  it('可見集合變大，工具箱只准變多：40 顆 ⊆ 100 顆 ⊆ 全部', () => {
    const reg = createRegistry()
    const getTypes = (components: Set<string>) => {
      const r = buildToolbox({
        blockSpecRegistry: reg,
        visibleComponents: components,
        ioPreference: 'iostream',
        msgs: emptyMsgs,
        categoryColors: CATEGORY_COLORS,
        categoryDefs: cppCategoryDefs,
      })
      const toolbox = r as { contents: Array<{ contents: Array<{ type: string }> }> }
      return new Set(toolbox.contents.flatMap(c => c.contents.map(b => b.type)))
    }
    const small = getTypes(firstN(topic, 40))
    const mid = getTypes(firstN(topic, 100))
    const all = getTypes(topicComponents(topic))
    // ★ 入口條件：三層真的一層比一層大（否則下面的包含關係是空話）
    expect(small.size, '🔴 最小那一層是空的').toBeGreaterThan(0)
    expect(mid.size).toBeGreaterThan(small.size)
    expect(all.size).toBeGreaterThan(mid.size)
    for (const t of small) expect(mid.has(t), `🔴 「${t}」在 40 顆時看得到，100 顆時不見了`).toBe(true)
    for (const t of mid) expect(all.has(t), `🔴 「${t}」在 100 顆時看得到，全部時不見了`).toBe(true)
  })

  it('should NOT import blockly (zero UI framework dependency)', () => {
    const filePath = path.resolve(__dirname, '../../../src/core/blocks/toolbox-builder.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    const importLines = content.match(/^import\s+.*from\s+['"]([^'"]+)['"]/gm) ?? []
    for (const line of importLines) {
      expect(line).not.toContain("'blockly'")
      expect(line).not.toContain('"blockly"')
    }
  })
})
