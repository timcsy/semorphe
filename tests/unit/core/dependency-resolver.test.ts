import { describe, it, expect } from 'vitest'
import type { DependencyResolver, DependencyEdge } from '../../../src/core/dependency-resolver'

/**
 * Contract tests for DependencyResolver interface.
 * Uses a simple mock implementation to verify contract rules.
 */
class MockDependencyResolver implements DependencyResolver {
  private conceptToHeader = new Map<string, { header: string; directive: string }>()

  addMapping(conceptId: string, header: string, directive: string): void {
    this.conceptToHeader.set(conceptId, { header, directive })
  }

  resolve(conceptIds: string[]): DependencyEdge[] {
    const seen = new Map<string, DependencyEdge>()
    for (const id of conceptIds) {
      const mapping = this.conceptToHeader.get(id)
      if (mapping && !seen.has(mapping.header)) {
        seen.set(mapping.header, {
          directive: mapping.directive,
          sourceType: 'stdlib',
          header: mapping.header,
          reason: id,
        })
      }
    }
    return [...seen.values()].sort((a, b) => a.header.localeCompare(b.header))
  }
}

describe('DependencyResolver contract', () => {
  it('should return empty array for empty conceptIds', () => {
    const resolver = new MockDependencyResolver()
    expect(resolver.resolve([])).toEqual([])
  })

  it('should return single edge for known concept', () => {
    const resolver = new MockDependencyResolver()
    resolver.addMapping('print', '<iostream>', '#include <iostream>')
    const edges = resolver.resolve(['print'])
    expect(edges).toHaveLength(1)
    expect(edges[0].header).toBe('<iostream>')
    expect(edges[0].directive).toBe('#include <iostream>')
    expect(edges[0].sourceType).toBe('stdlib')
    expect(edges[0].reason).toBe('print')
  })

  it('should deduplicate edges with same header', () => {
    const resolver = new MockDependencyResolver()
    resolver.addMapping('print', '<iostream>', '#include <iostream>')
    resolver.addMapping('endl', '<iostream>', '#include <iostream>')
    const edges = resolver.resolve(['print', 'endl'])
    expect(edges).toHaveLength(1)
    expect(edges[0].header).toBe('<iostream>')
  })

  it('should sort edges by header alphabetically', () => {
    const resolver = new MockDependencyResolver()
    resolver.addMapping('print', '<iostream>', '#include <iostream>')
    resolver.addMapping('vec', '<vector>', '#include <vector>')
    resolver.addMapping('sort', '<algorithm>', '#include <algorithm>')
    const edges = resolver.resolve(['print', 'vec', 'sort'])
    expect(edges.map(e => e.header)).toEqual(['<algorithm>', '<iostream>', '<vector>'])
  })

  it('should ignore unknown concepts', () => {
    const resolver = new MockDependencyResolver()
    resolver.addMapping('print', '<iostream>', '#include <iostream>')
    const edges = resolver.resolve(['print', 'unknown_concept', 'if', 'var_declare'])
    expect(edges).toHaveLength(1)
    expect(edges[0].header).toBe('<iostream>')
  })

  it('should set reason to the first concept that triggered the dependency', () => {
    const resolver = new MockDependencyResolver()
    resolver.addMapping('print', '<iostream>', '#include <iostream>')
    resolver.addMapping('input', '<iostream>', '#include <iostream>')
    const edges = resolver.resolve(['print', 'input'])
    expect(edges[0].reason).toBe('print')
  })
})
