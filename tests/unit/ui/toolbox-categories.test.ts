/**
 * TDD tests for C++ toolbox categories (language module)
 */
import { describe, it, expect } from 'vitest'
import { cppCategoryDefs } from '../../../src/languages/cpp/toolbox-categories'
import { buildToolbox } from '../../../src/ui/toolbox-builder'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import type { ComponentDefJSON, BlockProjectionJSON, Topic } from '../../../src/core/types'
import { getVisibleComponents } from '../../../src/core/level-tree'
// ⚠️ 走蓋過 owner 章的匯出，不要直接 import 原始 JSON——
// 工具箱靠 owner 決定歸屬，少了它整個通用分類會是空的。
import { universalComponents, universalBlocks } from '../../../src/core/universal'
import { coreComponents, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
import cppBeginnerTopic from '../../../src/languages/cpp/topics/cpp-beginner.json'
import { loadToolbox } from '../../helpers/toolbox'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalComponents ＋ coreComponents ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppComponents()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppComponents, allCppProjections } from '../../../src/languages/cpp/all-declarations'
import { ioTraitOf } from '../../../src/languages/cpp/core/node-traits'

const topic = cppBeginnerTopic as Topic

function createRegistry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  const allComponents = allCppComponents()
  const allProjections = allCppProjections()
  reg.loadFromSplit(allComponents, allProjections)
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
    const visible = getVisibleComponents(topic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    const tb = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents: visible,
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
  //
  // ⚠️ **而「問 layer」仍然是問錯了問題**（2026-08-11，第四版）。
  // 這裡真正要驗的是「**使用者偏好的那個 I/O 風格排在前面**」，
  // 而 `layer` 只是碰巧對——`cpp:print` 剛好標 universal。
  // 改成問那條**等價邊**：同 `ioRole` ＝ 同一個等價類，`ioStyle` ＝ 哪個成員。
  const style = (t: string) => {
    const cid = createRegistry().getByBlockType(t)?.componentMapping?.componentId
    return cid ? ioTraitOf(cid)?.style : undefined
  }

  it('I/O 分類：iostream 偏好時 iostream 風格的排在前面', () => {
    const types = ioContents('iostream')
    const firstOther = types.findIndex(t => style(t) !== 'iostream')
    const lastMatch = types.length - 1 - [...types].reverse().findIndex(t => style(t) === 'iostream')
    expect(firstOther, 'I/O 分類是空的 → 是建構壞了，不是排序對了').toBeGreaterThan(0)
    expect(firstOther).toBeGreaterThan(lastMatch)
  })

  it('I/O 分類：cstdio 偏好時 cstdio 風格的排在前面', () => {
    // ⚠️ **這一支的斷言換了，因為行為刻意改了。**
    //
    // 舊行為：`cstdio` 偏好時「**全部 lang 的**」排前面——包含 `getline`、
    // `ifstream_declare`、`ofstream_declare`。
    //
    // 而那三顆**沒有風格對立面**：它們不是「printf 版的什麼」，
    // 它們只是剛好不是 universal 層。**它們不該因為使用者選了 printf 就往前跳。**
    //
    // 新行為：宣告了 `ioStyle: 'cstdio'` 的排前面，其餘照原序。
    const types = ioContents('cstdio')
    const firstOther = types.findIndex(t => style(t) !== 'cstdio')
    const lastMatch = types.length - 1 - [...types].reverse().findIndex(t => style(t) === 'cstdio')
    expect(firstOther, '一顆 cstdio 風格的積木都沒有 → 量測壞了').toBeGreaterThan(0)
    expect(firstOther).toBeGreaterThan(lastMatch)
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
    const allComponents = getVisibleComponents(topic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c']))
    const result = buildToolbox({
      blockSpecRegistry: reg,
      visibleComponents: allComponents,
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
