import { describe, it, expect } from 'vitest'
import {
  getVisibleComponents,
  flattenLevelTree,
  resolveEnabledBranches,
  validateDoublingGuideline,
  isComponentVisible,
} from '../../../src/core/level-tree'
import type { LevelNode, Topic } from '../../../src/core/types'

const sampleTree: LevelNode = {
  id: 'L0',
  level: 0,
  label: 'L0: 基礎',
  components: ['cpp:print', 'cpp:var_declare', 'cpp:if', 'while'],
  children: [
    {
      id: 'L1a',
      level: 1,
      label: 'L1a: 函式',
      components: ['cpp:func_def', 'cpp:func_call', 'for_loop'],
      children: [
        {
          id: 'L2a',
          level: 2,
          label: 'L2a: 陣列',
          components: ['cpp:array_declare', 'cpp:array_at'],
          children: [],
        },
      ],
    },
    {
      id: 'L1b',
      level: 1,
      label: 'L1b: 控制流',
      components: ['switch_case', 'do_while'],
      children: [
        {
          id: 'L2b',
          level: 2,
          label: 'L2b: 指標',
          components: ['pointer', 'reference'],
          children: [],
        },
      ],
    },
  ],
}

const sampleTopic: Topic = {
  id: 'cpp-beginner',
  language: 'cpp',
  name: '初學 C++',
  levelTree: sampleTree,
}

describe('getVisibleComponents', () => {
  it('should return root components when only root enabled', () => {
    const result = getVisibleComponents(sampleTopic, new Set(['L0']))
    expect(result).toEqual(new Set(['cpp:print', 'cpp:var_declare', 'cpp:if', 'while']))
  })

  it('should return union of enabled branches', () => {
    const result = getVisibleComponents(sampleTopic, new Set(['L0', 'L1a']))
    expect(result).toEqual(
      new Set(['cpp:print', 'cpp:var_declare', 'cpp:if', 'while', 'cpp:func_def', 'cpp:func_call', 'for_loop'])
    )
  })

  it('should support multiple branches (union semantics)', () => {
    const result = getVisibleComponents(sampleTopic, new Set(['L0', 'L1a', 'L1b']))
    expect(result.has('cpp:func_def')).toBe(true)
    expect(result.has('switch_case')).toBe(true)
    expect(result.size).toBe(9)
  })

  it('should include deep branch components', () => {
    const result = getVisibleComponents(sampleTopic, new Set(['L0', 'L1a', 'L2a']))
    expect(result.has('cpp:array_declare')).toBe(true)
    expect(result.has('cpp:array_at')).toBe(true)
  })

  it('should return empty set when no branches enabled', () => {
    const result = getVisibleComponents(sampleTopic, new Set())
    expect(result.size).toBe(0)
  })
})

describe('flattenLevelTree', () => {
  it('should return all nodes in flat list', () => {
    const flat = flattenLevelTree(sampleTree)
    expect(flat).toHaveLength(5)
    expect(flat.map((n) => n.id)).toEqual(['L0', 'L1a', 'L2a', 'L1b', 'L2b'])
  })

  it('should handle single node tree', () => {
    const single: LevelNode = { id: 'root', level: 0, label: 'Root', components: [], children: [] }
    expect(flattenLevelTree(single)).toHaveLength(1)
  })
})

describe('resolveEnabledBranches', () => {
  it('should auto-enable ancestors when enabling a child', () => {
    const result = resolveEnabledBranches(sampleTree, new Set(['L2a']))
    expect(result.has('L0')).toBe(true)
    expect(result.has('L1a')).toBe(true)
    expect(result.has('L2a')).toBe(true)
  })

  it('should not enable siblings', () => {
    const result = resolveEnabledBranches(sampleTree, new Set(['L2a']))
    expect(result.has('L1b')).toBe(false)
    expect(result.has('L2b')).toBe(false)
  })

  it('should keep existing enabled branches', () => {
    const result = resolveEnabledBranches(sampleTree, new Set(['L1a', 'L1b']))
    expect(result.has('L0')).toBe(true)
    expect(result.has('L1a')).toBe(true)
    expect(result.has('L1b')).toBe(true)
  })
})

describe('validateDoublingGuideline', () => {
  it('should return no warnings for well-balanced tree', () => {
    const warnings = validateDoublingGuideline(sampleTree)
    expect(warnings.every((w) => w.severity === 'warning')).toBe(true)
  })

  it('should warn when child has too many components relative to parent', () => {
    const unbalanced: LevelNode = {
      id: 'L0',
      level: 0,
      label: 'L0',
      components: ['a'],
      children: [
        {
          id: 'L1',
          level: 1,
          label: 'L1',
          components: ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
          children: [],
        },
      ],
    }
    const warnings = validateDoublingGuideline(unbalanced)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe('isComponentVisible', () => {
  it('should return true for component in enabled branch', () => {
    expect(isComponentVisible('cpp:func_def', sampleTopic, new Set(['L0', 'L1a']))).toBe(true)
  })

  it('should return false for component not in enabled branches', () => {
    expect(isComponentVisible('switch_case', sampleTopic, new Set(['L0', 'L1a']))).toBe(false)
  })

  it('should return false for unknown component', () => {
    expect(isComponentVisible('nonexistent', sampleTopic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b']))).toBe(false)
  })
})
