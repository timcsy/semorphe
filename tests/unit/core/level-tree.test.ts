import { describe, it, expect } from 'vitest'
import {
  getVisibleConcepts,
  flattenLevelTree,
  resolveEnabledBranches,
  validateDoublingGuideline,
  isConceptVisible,
} from '../../../src/core/level-tree'
import type { LevelNode, Topic } from '../../../src/core/types'

const sampleTree: LevelNode = {
  id: 'L0',
  level: 0,
  label: 'L0: 基礎',
  concepts: ['lang:print', 'lang:var_declare', 'lang:if', 'while'],
  children: [
    {
      id: 'L1a',
      level: 1,
      label: 'L1a: 函式',
      concepts: ['lang:func_def', 'lang:func_call', 'for_loop'],
      children: [
        {
          id: 'L2a',
          level: 2,
          label: 'L2a: 陣列',
          concepts: ['lang:array_declare', 'lang:array_access'],
          children: [],
        },
      ],
    },
    {
      id: 'L1b',
      level: 1,
      label: 'L1b: 控制流',
      concepts: ['switch_case', 'do_while'],
      children: [
        {
          id: 'L2b',
          level: 2,
          label: 'L2b: 指標',
          concepts: ['pointer', 'reference'],
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

describe('getVisibleConcepts', () => {
  it('should return root concepts when only root enabled', () => {
    const result = getVisibleConcepts(sampleTopic, new Set(['L0']))
    expect(result).toEqual(new Set(['lang:print', 'lang:var_declare', 'lang:if', 'while']))
  })

  it('should return union of enabled branches', () => {
    const result = getVisibleConcepts(sampleTopic, new Set(['L0', 'L1a']))
    expect(result).toEqual(
      new Set(['lang:print', 'lang:var_declare', 'lang:if', 'while', 'lang:func_def', 'lang:func_call', 'for_loop'])
    )
  })

  it('should support multiple branches (union semantics)', () => {
    const result = getVisibleConcepts(sampleTopic, new Set(['L0', 'L1a', 'L1b']))
    expect(result.has('lang:func_def')).toBe(true)
    expect(result.has('switch_case')).toBe(true)
    expect(result.size).toBe(9)
  })

  it('should include deep branch concepts', () => {
    const result = getVisibleConcepts(sampleTopic, new Set(['L0', 'L1a', 'L2a']))
    expect(result.has('lang:array_declare')).toBe(true)
    expect(result.has('lang:array_access')).toBe(true)
  })

  it('should return empty set when no branches enabled', () => {
    const result = getVisibleConcepts(sampleTopic, new Set())
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
    const single: LevelNode = { id: 'root', level: 0, label: 'Root', concepts: [], children: [] }
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

  it('should warn when child has too many concepts relative to parent', () => {
    const unbalanced: LevelNode = {
      id: 'L0',
      level: 0,
      label: 'L0',
      concepts: ['a'],
      children: [
        {
          id: 'L1',
          level: 1,
          label: 'L1',
          concepts: ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
          children: [],
        },
      ],
    }
    const warnings = validateDoublingGuideline(unbalanced)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe('isConceptVisible', () => {
  it('should return true for concept in enabled branch', () => {
    expect(isConceptVisible('lang:func_def', sampleTopic, new Set(['L0', 'L1a']))).toBe(true)
  })

  it('should return false for concept not in enabled branches', () => {
    expect(isConceptVisible('switch_case', sampleTopic, new Set(['L0', 'L1a']))).toBe(false)
  })

  it('should return false for unknown concept', () => {
    expect(isConceptVisible('nonexistent', sampleTopic, new Set(['L0', 'L1a', 'L1b', 'L2a', 'L2b']))).toBe(false)
  })
})
