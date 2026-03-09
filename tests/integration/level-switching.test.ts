import { describe, it, expect } from 'vitest'
import { getBlockLevel, isBlockAvailable, filterBlocksByLevel } from '../../src/core/cognitive-levels'
import type { CognitiveLevel } from '../../src/core/types'

describe('Cognitive Level Switching', () => {
  describe('getBlockLevel', () => {
    it('should assign L0 to basic blocks', () => {
      expect(getBlockLevel('u_var_declare')).toBe(0)
      expect(getBlockLevel('u_number')).toBe(0)
      expect(getBlockLevel('u_if')).toBe(0)
      expect(getBlockLevel('u_while_loop')).toBe(0)
      expect(getBlockLevel('u_print')).toBe(0)
    })

    it('should assign L1 to intermediate blocks', () => {
      expect(getBlockLevel('u_logic')).toBe(1)
      expect(getBlockLevel('u_func_def')).toBe(1)
      expect(getBlockLevel('u_count_loop')).toBe(1)
      expect(getBlockLevel('u_break')).toBe(1)
      expect(getBlockLevel('u_return')).toBe(1)
    })

    it('should assign L2 to advanced blocks', () => {
      expect(getBlockLevel('u_array_declare')).toBe(2)
      expect(getBlockLevel('u_array_access')).toBe(2)
      expect(getBlockLevel('c_raw_code')).toBe(2)
      expect(getBlockLevel('c_include')).toBe(0)
    })

    it('should default unknown blocks to L2', () => {
      expect(getBlockLevel('some_unknown_block')).toBe(2)
    })
  })

  describe('isBlockAvailable', () => {
    it('should make L0 blocks available at all levels', () => {
      expect(isBlockAvailable('u_var_declare', 0)).toBe(true)
      expect(isBlockAvailable('u_var_declare', 1)).toBe(true)
      expect(isBlockAvailable('u_var_declare', 2)).toBe(true)
    })

    it('should hide L1 blocks at L0', () => {
      expect(isBlockAvailable('u_func_def', 0)).toBe(false)
      expect(isBlockAvailable('u_func_def', 1)).toBe(true)
      expect(isBlockAvailable('u_func_def', 2)).toBe(true)
    })

    it('should hide L2 blocks at L0 and L1', () => {
      expect(isBlockAvailable('u_array_declare', 0)).toBe(false)
      expect(isBlockAvailable('u_array_declare', 1)).toBe(false)
      expect(isBlockAvailable('u_array_declare', 2)).toBe(true)
    })
  })

  describe('filterBlocksByLevel', () => {
    const allBlocks = [
      'u_var_declare', 'u_number', 'u_arithmetic', 'u_if', 'u_print',  // L0
      'u_logic', 'u_func_def', 'u_count_loop',                          // L1
      'u_array_declare', 'c_raw_code',                                   // L2
    ]

    it('should show only L0 blocks at level 0', () => {
      const filtered = filterBlocksByLevel(allBlocks, 0 as CognitiveLevel)
      expect(filtered).toEqual(['u_var_declare', 'u_number', 'u_arithmetic', 'u_if', 'u_print'])
    })

    it('should show L0+L1 blocks at level 1', () => {
      const filtered = filterBlocksByLevel(allBlocks, 1 as CognitiveLevel)
      expect(filtered).toEqual([
        'u_var_declare', 'u_number', 'u_arithmetic', 'u_if', 'u_print',
        'u_logic', 'u_func_def', 'u_count_loop',
      ])
    })

    it('should show all blocks at level 2', () => {
      const filtered = filterBlocksByLevel(allBlocks, 2 as CognitiveLevel)
      expect(filtered).toEqual(allBlocks)
    })
  })

  describe('toolbox category filtering', () => {
    it('should hide functions category at L0', () => {
      const funcBlocks = ['u_func_def', 'u_func_call', 'u_return']
      const filtered = filterBlocksByLevel(funcBlocks, 0 as CognitiveLevel)
      expect(filtered).toHaveLength(0)
    })

    it('should show functions category at L1', () => {
      const funcBlocks = ['u_func_def', 'u_func_call', 'u_return']
      const filtered = filterBlocksByLevel(funcBlocks, 1 as CognitiveLevel)
      expect(filtered).toHaveLength(3)
    })

    it('should show partial data category at L0 (no arrays)', () => {
      const dataBlocks = ['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string', 'u_array_declare', 'u_array_access']
      const filtered = filterBlocksByLevel(dataBlocks, 0 as CognitiveLevel)
      expect(filtered).toEqual(['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string'])
    })

    it('should show partial operators at L0 (no logic)', () => {
      const opBlocks = ['u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate']
      const filtered = filterBlocksByLevel(opBlocks, 0 as CognitiveLevel)
      expect(filtered).toEqual(['u_arithmetic', 'u_compare'])
    })
  })
})
