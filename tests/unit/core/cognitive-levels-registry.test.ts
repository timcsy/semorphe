/**
 * TDD tests for Phase A Item 2: BLOCK_LEVELS → BlockSpecRegistry.level
 *
 * After refactoring, getBlockLevel() should query BlockSpecRegistry
 * instead of using hardcoded BLOCK_LEVELS constant.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { getBlockLevel, isBlockAvailable, filterBlocksByLevel, setBlockSpecRegistry } from '../../../src/core/cognitive-levels'
import type { CognitiveLevel } from '../../../src/core/types'

describe('cognitive-levels registry integration', () => {
  let registry: BlockSpecRegistry

  beforeEach(() => {
    registry = new BlockSpecRegistry()
    // Load a few sample specs with known levels
    registry.loadFromJSON([
      makeSpec('u_var_declare', 'var_declare', 0),
      makeSpec('u_print', 'print', 0),
      makeSpec('u_func_def', 'func_def', 1),
      makeSpec('c_raw_code', 'raw_code', 2),
      makeSpec('c_for_loop', 'cpp_for_loop', 1),
    ])
    setBlockSpecRegistry(registry)
  })

  it('getBlockLevel returns level from registry', () => {
    expect(getBlockLevel('u_var_declare')).toBe(0)
    expect(getBlockLevel('u_func_def')).toBe(1)
    expect(getBlockLevel('c_raw_code')).toBe(2)
  })

  it('unknown blocks default to L2', () => {
    expect(getBlockLevel('nonexistent_block')).toBe(2)
  })

  it('isBlockAvailable uses registry levels', () => {
    expect(isBlockAvailable('u_var_declare', 0)).toBe(true)
    expect(isBlockAvailable('u_func_def', 0)).toBe(false)
    expect(isBlockAvailable('u_func_def', 1)).toBe(true)
    expect(isBlockAvailable('c_raw_code', 1)).toBe(false)
    expect(isBlockAvailable('c_raw_code', 2)).toBe(true)
  })

  it('filterBlocksByLevel uses registry levels', () => {
    const all = ['u_var_declare', 'u_print', 'u_func_def', 'c_raw_code']
    expect(filterBlocksByLevel(all, 0)).toEqual(['u_var_declare', 'u_print'])
    expect(filterBlocksByLevel(all, 1)).toEqual(['u_var_declare', 'u_print', 'u_func_def'])
    expect(filterBlocksByLevel(all, 2)).toEqual(all)
  })

  it('getLevel on BlockSpecRegistry returns correct level', () => {
    expect(registry.getLevel('u_var_declare')).toBe(0)
    expect(registry.getLevel('u_func_def')).toBe(1)
    expect(registry.getLevel('c_raw_code')).toBe(2)
  })

  it('getLevel defaults to 2 for unknown block type', () => {
    expect(registry.getLevel('unknown_block')).toBe(2)
  })
})

function makeSpec(blockType: string, conceptId: string, level: CognitiveLevel) {
  return {
    id: blockType,
    language: 'cpp',
    category: 'test',
    level,
    version: '1.0.0',
    concept: { conceptId },
    blockDef: { type: blockType },
    codeTemplate: { pattern: '', imports: [], order: 0 },
    astPattern: { nodeType: '_none', constraints: [] },
  }
}
