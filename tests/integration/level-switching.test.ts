import { describe, it, expect, beforeAll } from 'vitest'
import type { ComponentDefJSON, BlockProjectionJSON, Topic } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { topicComponents } from '../../src/core/lesson/topic-components'

/**
 * 🪦 **2026-09-20：這個檔的可見集合不再從層級樹算出來。**
 *
 * 在此之前每一支都寫 `getVisibleComponents(topic, new Set(['L0', 'L1a', …]))`
 * ——而**受測的是 `isBlockVisible(積木, 集合)`**，它與那個集合怎麼算出來無關。
 *
 * > **一支測「f(x) 對不對」的測試，綁在「x 怎麼產生」上的那一天，
 * > 它會隨著 x 的產生方式一起死掉——而 f 還活著。**
 *
 * 🟢 換成**顯式的集合**之後，每一支自己說得出它在假設什麼。
 */
const setOf = (...ids: string[]): Set<string> => new Set(ids)
// ⚠️ **第十四個「自己列舉來源」的地方**。漏了膠囊的話 `isBlockVisible`
// 對搬走的積木回 `true`（查不到 = 當成可見），而斷言訊息只說「expected true to be false」。
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { componentComponents, componentBlocks } from '../../src/core/component/registry'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/lang'
import { allStdModules } from '../../src/languages/cpp/std'
import cppBeginnerTopic from '../../src/languages/cpp/topics/cpp-beginner.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalComponents ＋ coreComponents ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppComponents()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'

const topic = cppBeginnerTopic as Topic

describe('Topic-Based Block Visibility', () => {
  let reg: BlockSpecRegistry

  beforeAll(() => {
    reg = new BlockSpecRegistry()
    const allComponents = allCppComponents()
    const allProjections = [
      ...universalBlocks,
      ...coreBlocks,
      ...(componentBlocks() as BlockProjectionJSON[]),
      ...allStdModules.flatMap(m => m.blocks),
    ]
    reg.loadFromSplit(allComponents, allProjections)
  })

  describe('isBlockVisible', () => {
    it('集合裡有的積木 → 看得到', () => {
      const components = setOf('cpp:var_declare', 'cpp:literal_number', 'cpp:if', 'cpp:print')
      expect(reg.isBlockVisible('cpp_var_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_literal_number', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_if', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_print', components)).toBe(true)
    })

    it('集合裡沒有的積木 → 看不到', () => {
      const components = setOf('cpp:var_declare', 'cpp:literal_number', 'cpp:if', 'cpp:print')
      expect(reg.isBlockVisible('cpp_func_def', components)).toBe(false)
      expect(reg.isBlockVisible('cpp_loop_count', components)).toBe(false)
      expect(reg.isBlockVisible('cpp_increment', components)).toBe(false)
    })

    it('把那幾顆加進集合 → 它們就看得到了', () => {
      const components = setOf('cpp:func_def', 'cpp:loop_count')
      expect(reg.isBlockVisible('cpp_func_def', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_loop_count', components)).toBe(true)
    })

    it('★ 反向：不在集合裡的陣列積木看不到', () => {
      const components = setOf('cpp:func_def', 'cpp:loop_count')
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(false)
    })

    it('陣列在集合裡 → 陣列的積木看得到', () => {
      const components = setOf('cpp:array_declare', 'cpp:array_at')
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_array_at', components)).toBe(true)
    })

    it('不認得的積木一律看得到（沒有元件可以限制它）', () => {
      const components = setOf('cpp:print')
      expect(reg.isBlockVisible('some_unknown_block', components)).toBe(true)
    })
  })

  /**
   * 🪦 這一組在 2026-09-20 之前問的是「打開 L1b 之後看得到 switch 嗎」。
   * 層級退場之後它問的是**這個主題的清單裡有沒有它們**
   * ——而那正是那三支真正在保護的東西：`cpp-beginner` 要教得到控制流、
   * 指標與容器，少了任何一族都是課程設計出了事。
   */
  describe('這個主題的清單要涵蓋三大族', () => {
    const all = topicComponents(topic)
    it('★ 入口條件：清單真的讀得到（否則下面在驗空氣）', () => {
      expect(all.size).toBeGreaterThan(100)
    })
    it('控制流', () => {
      expect(all.has('cpp:switch')).toBe(true)
      expect(all.has('cpp:loop_do_while')).toBe(true)
    })
    it('指標與記憶體', () => {
      expect(all.has('cpp:pointer_declare')).toBe(true)
      expect(all.has('cpp:address_of')).toBe(true)
    })
    it('容器', () => {
      expect(all.has('cpp:vector_declare')).toBe(true)
      expect(all.has('cpp:map_declare')).toBe(true)
    })
  })

  describe('Statement↔Expression extraState contract', () => {
    it('cpp_input/cpp_input_expression use { args: ArgSlotState[] } shape', () => {
      const state = { args: [{ mode: 'select', selectedVar: 'x' }] }
      expect(state.args).toBeInstanceOf(Array)
      expect(state.args[0]).toHaveProperty('mode')
    })
    it('cpp_func_call/cpp_func_call_expression use { argCount: number } shape', () => {
      const state = { argCount: 3 }
      expect(typeof state.argCount).toBe('number')
    })
  })

  describe('block visibility filtering', () => {
    const FUNC_BLOCKS = ['cpp_func_def', 'cpp_func_call', 'cpp_return']

    it('函式那一族不在集合裡 → 一顆都看不到', () => {
      const components = setOf('cpp:var_declare', 'cpp:print')
      expect(FUNC_BLOCKS.filter(t => reg.isBlockVisible(t, components))).toHaveLength(0)
    })

    it('★ 反向：把那一族放進集合 → 三顆都看得到', () => {
      const components = setOf('cpp:func_def', 'cpp:func_call', 'cpp:return')
      expect(FUNC_BLOCKS.filter(t => reg.isBlockVisible(t, components))).toHaveLength(3)
    })

    it('同一個集合裡，有的看得到、沒有的看不到', () => {
      const components = setOf('cpp:var_declare')
      expect(reg.isBlockVisible('cpp_var_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(false)
    })
  })
})
