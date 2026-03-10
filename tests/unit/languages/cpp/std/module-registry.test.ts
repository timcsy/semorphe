import { describe, it, expect } from 'vitest'
import { ModuleRegistry } from '../../../../../src/languages/cpp/std/module-registry'
import type { StdModule } from '../../../../../src/languages/cpp/std/types'

function createMockModule(header: string, conceptIds: string[]): StdModule {
  return {
    header,
    concepts: conceptIds.map(id => ({ conceptId: id, properties: {}, children: {} })) as any[],
    blocks: [],
    registerGenerators: () => {},
    registerLifters: () => {},
  }
}

describe('ModuleRegistry', () => {
  it('should register a module and query by header', () => {
    const registry = new ModuleRegistry()
    const mod = createMockModule('<iostream>', ['print', 'input', 'endl'])
    registry.register(mod)

    expect(registry.getModule('<iostream>')).toBe(mod)
    expect(registry.getModule('<vector>')).toBeUndefined()
  })

  it('should map concepts to headers', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['print', 'input']))
    registry.register(createMockModule('<cstdio>', ['cpp_printf', 'cpp_scanf']))

    expect(registry.getHeaderForConcept('print')).toBe('<iostream>')
    expect(registry.getHeaderForConcept('cpp_printf')).toBe('<cstdio>')
    expect(registry.getHeaderForConcept('if')).toBeNull()
  })

  it('should return all modules', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['print']))
    registry.register(createMockModule('<cstdio>', ['cpp_printf']))

    expect(registry.getAllModules()).toHaveLength(2)
  })

  it('should support manual concept mapping', () => {
    const registry = new ModuleRegistry()
    registry.registerConceptMapping('print', '<iostream>')

    expect(registry.getHeaderForConcept('print')).toBe('<iostream>')
  })

  // ─── DependencyResolver.resolve() tests ───

  describe('resolve() (DependencyResolver)', () => {
    it('should return empty array for empty conceptIds', () => {
      const registry = new ModuleRegistry()
      expect(registry.resolve([])).toEqual([])
    })

    it('should return DependencyEdge with correct fields', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['print']))

      const edges = registry.resolve(['print'])
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        directive: '#include <iostream>',
        sourceType: 'stdlib',
        header: '<iostream>',
        reason: 'print',
      })
    })

    it('should deduplicate edges for same header', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['print', 'input', 'endl']))

      const edges = registry.resolve(['print', 'input', 'endl'])
      expect(edges).toHaveLength(1)
      expect(edges[0].header).toBe('<iostream>')
      expect(edges[0].reason).toBe('print') // first concept wins
    })

    it('should sort edges by header', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['print']))
      registry.register(createMockModule('<vector>', ['vector_create']))
      registry.register(createMockModule('<algorithm>', ['algorithm_sort']))

      const edges = registry.resolve(['print', 'vector_create', 'algorithm_sort'])
      expect(edges.map(e => e.header)).toEqual(['<algorithm>', '<iostream>', '<vector>'])
    })

    it('should ignore unknown concepts', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['print']))

      const edges = registry.resolve(['print', 'if', 'var_declare', 'unknown'])
      expect(edges).toHaveLength(1)
    })

    it('should produce same header set as old getRequiredHeaders would', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['print', 'input']))
      registry.register(createMockModule('<vector>', ['vector_create']))
      registry.register(createMockModule('<algorithm>', ['algorithm_sort']))

      const conceptIds = ['print', 'vector_create', 'algorithm_sort', 'if']
      const edges = registry.resolve(conceptIds)
      const headers = edges.map(e => e.header)
      expect(headers).toEqual(['<algorithm>', '<iostream>', '<vector>'])
    })
  })
})
