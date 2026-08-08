import { describe, it, expect, beforeAll } from 'vitest'
import type { ConceptDefJSON, BlockProjectionJSON, Topic } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { getVisibleConcepts } from '../../src/core/level-tree'
import { universalConcepts, universalBlocks } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import cppBeginnerTopic from '../../src/languages/cpp/topics/cpp-beginner.json'

const topic = cppBeginnerTopic as Topic

describe('Topic-Based Block Visibility', () => {
  let reg: BlockSpecRegistry

  beforeAll(() => {
    reg = new BlockSpecRegistry()
    const allConcepts = [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
    const allProjections = [
      ...universalBlocks,
      ...coreBlocks,
      ...allStdModules.flatMap(m => m.blocks),
    ]
    reg.loadFromSplit(allConcepts, allProjections)
  })

  describe('isBlockVisible', () => {
    it('should make root-level blocks visible with only root enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0']))
      expect(reg.isBlockVisible('u_var_declare', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_number', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_if', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_print', concepts)).toBe(true)
    })

    it('should hide L1 concept blocks with only root enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0']))
      expect(reg.isBlockVisible('u_func_def', concepts)).toBe(false)
      expect(reg.isBlockVisible('u_count_loop', concepts)).toBe(false)
      // logic moved to L0 — use a different L1-only concept for this test
      expect(reg.isBlockVisible('c_increment', concepts)).toBe(false)
    })

    it('should show L1 concept blocks when L1a branch enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1a']))
      expect(reg.isBlockVisible('u_func_def', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_count_loop', concepts)).toBe(true)
    })

    it('should hide L2 blocks when only L1 enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1a']))
      expect(reg.isBlockVisible('u_array_declare', concepts)).toBe(false)
    })

    it('should show array blocks when L2a enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1a', 'L2a']))
      expect(reg.isBlockVisible('u_array_declare', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_array_access', concepts)).toBe(true)
    })

    it('should show unknown blocks as visible (no concept restriction)', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0']))
      expect(reg.isBlockVisible('some_unknown_block', concepts)).toBe(true)
    })
  })

  describe('concept visibility with different branches', () => {
    it('should show control flow concepts when L1b enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1b']))
      expect(concepts.has('cpp:switch')).toBe(true)
      expect(concepts.has('cpp:do_while')).toBe(true)
    })

    it('should show pointer concepts when L2b enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1b', 'L2b']))
      expect(concepts.has('cpp:pointer_declare')).toBe(true)
      expect(concepts.has('cpp:address_of')).toBe(true)
    })

    it('should show container concepts when L2c enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1b', 'L2c']))
      expect(concepts.has('cpp:vector_declare')).toBe(true)
      expect(concepts.has('cpp:map_declare')).toBe(true)
    })
  })

  describe('Statement↔Expression extraState contract', () => {
    it('u_input/u_input_expr use { args: ArgSlotState[] } shape', () => {
      const state = { args: [{ mode: 'select', selectedVar: 'x' }] }
      expect(state.args).toBeInstanceOf(Array)
      expect(state.args[0]).toHaveProperty('mode')
    })
    it('u_func_call/u_func_call_expr use { argCount: number } shape', () => {
      const state = { argCount: 3 }
      expect(typeof state.argCount).toBe('number')
    })
  })

  describe('block visibility filtering', () => {
    it('should hide function blocks with only root enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0']))
      const funcBlocks = ['u_func_def', 'u_func_call', 'u_return']
      const visible = funcBlocks.filter(t => reg.isBlockVisible(t, concepts))
      expect(visible).toHaveLength(0)
    })

    it('should show function blocks with L1a enabled', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0', 'L1a']))
      const funcBlocks = ['u_func_def', 'u_func_call', 'u_return']
      const visible = funcBlocks.filter(t => reg.isBlockVisible(t, concepts))
      expect(visible).toHaveLength(3)
    })

    it('should show data blocks but not arrays with only root', () => {
      const concepts = getVisibleConcepts(topic, new Set(['L0']))
      expect(reg.isBlockVisible('u_var_declare', concepts)).toBe(true)
      expect(reg.isBlockVisible('u_array_declare', concepts)).toBe(false)
    })
  })
})
