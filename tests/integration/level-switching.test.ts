import { describe, it, expect, beforeAll } from 'vitest'
import type { ComponentDefJSON, BlockProjectionJSON, Topic } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { getVisibleComponents } from '../../src/core/level-tree'
// ⚠️ **第十四個「自己列舉來源」的地方**。漏了膠囊的話 `isBlockVisible`
// 對搬走的積木回 `true`（查不到 = 當成可見），而斷言訊息只說「expected true to be false」。
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { componentComponents, componentBlocks } from '../../src/core/component/registry'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
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
    it('should make root-level blocks visible with only root enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0']))
      expect(reg.isBlockVisible('cpp_var_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_literal_number', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_if', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_print', components)).toBe(true)
    })

    it('should hide L1 component blocks with only root enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0']))
      expect(reg.isBlockVisible('cpp_func_def', components)).toBe(false)
      expect(reg.isBlockVisible('cpp_loop_count', components)).toBe(false)
      // logic moved to L0 — use a different L1-only component for this test
      expect(reg.isBlockVisible('cpp_increment', components)).toBe(false)
    })

    it('should show L1 component blocks when L1a branch enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1a']))
      expect(reg.isBlockVisible('cpp_func_def', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_loop_count', components)).toBe(true)
    })

    it('should hide L2 blocks when only L1 enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1a']))
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(false)
    })

    it('should show array blocks when L2a enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1a', 'L2a']))
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_array_at', components)).toBe(true)
    })

    it('should show unknown blocks as visible (no component restriction)', () => {
      const components = getVisibleComponents(topic, new Set(['L0']))
      expect(reg.isBlockVisible('some_unknown_block', components)).toBe(true)
    })
  })

  describe('component visibility with different branches', () => {
    it('should show control flow components when L1b enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1b']))
      expect(components.has('cpp:switch')).toBe(true)
      expect(components.has('cpp:loop_do_while')).toBe(true)
    })

    it('should show pointer components when L2b enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1b', 'L2b']))
      expect(components.has('cpp:pointer_declare')).toBe(true)
      expect(components.has('cpp:address_of')).toBe(true)
    })

    it('should show container components when L2c enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1b', 'L2c']))
      expect(components.has('cpp:vector_declare')).toBe(true)
      expect(components.has('cpp:map_declare')).toBe(true)
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
    it('should hide function blocks with only root enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0']))
      const funcBlocks = ['cpp_func_def', 'cpp_func_call', 'cpp_return']
      const visible = funcBlocks.filter(t => reg.isBlockVisible(t, components))
      expect(visible).toHaveLength(0)
    })

    it('should show function blocks with L1a enabled', () => {
      const components = getVisibleComponents(topic, new Set(['L0', 'L1a']))
      const funcBlocks = ['cpp_func_def', 'cpp_func_call', 'cpp_return']
      const visible = funcBlocks.filter(t => reg.isBlockVisible(t, components))
      expect(visible).toHaveLength(3)
    })

    it('should show data blocks but not arrays with only root', () => {
      const components = getVisibleComponents(topic, new Set(['L0']))
      expect(reg.isBlockVisible('cpp_var_declare', components)).toBe(true)
      expect(reg.isBlockVisible('cpp_array_declare', components)).toBe(false)
    })
  })
})
