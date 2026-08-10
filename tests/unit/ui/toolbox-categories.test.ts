/**
 * TDD tests for C++ toolbox categories (language module)
 */
import { describe, it, expect } from 'vitest'
import { cppCategoryDefs } from '../../../src/languages/cpp/toolbox-categories'
import { buildToolbox } from '../../../src/ui/toolbox-builder'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import type { ConceptDefJSON, BlockProjectionJSON, Topic } from '../../../src/core/types'
import { getVisibleConcepts } from '../../../src/core/level-tree'
// ⚠️ 走蓋過 owner 章的匯出，不要直接 import 原始 JSON——
// 工具箱靠 owner 決定歸屬，少了它整個通用分類會是空的。
import { universalConcepts, universalBlocks } from '../../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
import cppBeginnerTopic from '../../../src/languages/cpp/topics/cpp-beginner.json'
import { loadToolbox } from '../../helpers/toolbox'

const topic = cppBeginnerTopic as Topic

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
  const allProjections = [
    ...universalBlocks,
    ...coreBlocks,
    ...allStdModules.flatMap(m => m.blocks),
  ]
  reg.loadFromSplit(allConcepts, allProjections)
  return reg
}

describe('C++ toolbox categories (language module)', () => {
  it('cppCategoryDefs has expected categories', () => {
    const keys = cppCategoryDefs.map(d => d.key)
    expect(keys).toContain('data')
    expect(keys).toContain('operators')
    expect(keys).toContain('control')
    expect(keys).toContain('functions')
    expect(keys).toContain('io')
    expect(keys).toContain('arrays_lists')
    expect(keys).toContain('text')
    expect(keys).toContain('maps_sets')
    expect(keys).toContain('stacks_queues')
    expect(keys).toContain('pointers_memory')
    expect(keys).toContain('structs_classes')
    expect(keys).toContain('program_config')
  })

  it('each category has required properties', () => {
    for (const def of cppCategoryDefs) {
      expect(def.key).toBeDefined()
      expect(def.nameKey).toBeDefined()
      expect(def.fallback).toBeDefined()
      expect(def.colorKey).toBeDefined()
      expect(def.sources, '每個分類都要有**有序的**來源段落——那是教學順序').toBeInstanceOf(Array)
      for (const src of def.sources) {
        expect(src.from, '段落要指名來源（模組 header／(core)／(universal)）').toBeTruthy()
        expect(src.category, '段落要指名登錄分類').toBeTruthy()
      }
    }
  })

  // ⚠️ 這一支原本測的是 `buildIoCategoryContents`——一份**沒有任何產品程式碼
  // 在用**的拷貝。它通過了三個月，而真正上線的那條路有一模一樣的缺陷。
  // 改成走 `buildToolbox` 的真實路徑。
  function ioContents(pref: 'iostream' | 'cstdio'): string[] {
    const reg = createRegistry()
    const visible = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    const tb = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: visible,
      ioPreference: pref,
      msgs: {},
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    }) as { contents: { name: string; contents: { type: string }[] }[] }
    const io = tb.contents.find(c => c.name.includes('輸入'))
    return (io?.contents ?? []).map(b => b.type)
  }

  // ⚠️ **這兩支測試自己也在拿形狀當判斷**（`startsWith('u_')`）。
  // 116 把積木型別改成從身分導出之後沒有型別以 `u_` 開頭，於是它們
  // 量到的「通用積木」是空集合——**測試與被測物同時犯同一個錯**，
  // 而那時測試不會保護任何東西。改成問宣告的 `layer`。
  const 是通用的 = (t: string) =>
    createRegistry().getByBlockType(t)?.conceptMapping?.layer === 'universal'

  it('I/O 分類：iostream 偏好時通用版排在語言版之前', () => {
    const types = ioContents('iostream')
    const firstLang = types.findIndex(t => !是通用的(t))
    const lastUniversal = types.length - 1 - [...types].reverse().findIndex(是通用的)
    expect(firstLang, 'I/O 分類是空的 → 是建構壞了，不是排序對了').toBeGreaterThan(0)
    expect(firstLang).toBeGreaterThan(lastUniversal)
  })

  it('I/O 分類：cstdio 偏好時反過來', () => {
    const types = ioContents('cstdio')
    const firstUniversal = types.findIndex(是通用的)
    const lastLang = types.length - 1 - [...types].reverse().findIndex(t => !是通用的(t))
    expect(firstUniversal).toBeGreaterThan(lastLang)
  })

  it('★ `cpp_` 開頭的 I/O 積木不得被排序函式丟掉', () => {
    // 迴歸釘：原本的 `startsWith('c_')` 兩邊都不收 `cpp_*`，
    // 於是三顆 `category: 'io'` 的積木靜靜消失。
    //
    // ⚠️ 這裡必須用**全部概念可見**。用 topic 的可見集合會把 `<fstream>`
    // 擋掉（課程沒收錄它），於是這支測試會因為**別的理由**紅——
    // 而「課程沒收錄」與「排序函式吃掉它」是兩件完全不同的事。
    const { snapshot } = loadToolbox()
    const types = snapshot.categories.find(c => c.name.includes('輸入'))?.blocks ?? []
    // ⚠️ 這裡列的是**積木型別**（`snapshot.categories[].blocks`），不是元件身分。
    // 命名空間遷移只動身分，積木型別維持 `cpp_`（B 項加法式保留）。
    for (const t of ['cpp_input_line', 'cpp_ifstream_declare', 'cpp_ofstream_declare']) {
      expect(types, `${t} 的 category 明明是 'io'，卻不在 I/O 分類裡`).toContain(t)
    }
  })

  it('buildToolbox accepts external categoryDefs', () => {
    const reg = createRegistry()
    const allConcepts = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: allConcepts,
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
