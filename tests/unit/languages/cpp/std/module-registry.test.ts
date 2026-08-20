import { describe, it, expect } from 'vitest'
import { ModuleRegistry } from '../../../../../src/languages/cpp/std/module-registry'
import type { StdModule } from '../../../../../src/languages/cpp/std/types'

function createMockModule(header: string, componentIds: string[]): StdModule {
  return {
    header,
    components: componentIds.map(id => ({ componentId: id, properties: {}, children: {} })) as any[],
    blocks: [],
    registerGenerators: () => {},
    registerLifters: () => {},
  }
}

describe('ModuleRegistry', () => {
  it('should register a module and query by header', () => {
    const registry = new ModuleRegistry()
    const mod = createMockModule('<iostream>', ['cpp:print', 'cpp:input', 'cpp:endl'])
    registry.register(mod)

    expect(registry.getModule('<iostream>')).toBe(mod)
    expect(registry.getModule('<vector>')).toBeUndefined()
  })

  it('should map components to headers', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['cpp:print', 'cpp:input']))
    registry.register(createMockModule('<cstdio>', ['cpp:print_formatted', 'cpp:input_formatted']))

    expect(registry.getHeaderForComponent('cpp:print')).toBe('<iostream>')
    expect(registry.getHeaderForComponent('cpp:print_formatted')).toBe('<cstdio>')
    expect(registry.getHeaderForComponent('cpp:if')).toBeNull()
  })

  it('should return all modules', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['cpp:print']))
    registry.register(createMockModule('<cstdio>', ['cpp:print_formatted']))

    expect(registry.getAllModules()).toHaveLength(2)
  })

  it('should support manual component mapping', () => {
    const registry = new ModuleRegistry()
    registry.registerComponentMapping('cpp:print', '<iostream>')

    expect(registry.getHeaderForComponent('cpp:print')).toBe('<iostream>')
  })

  // ─── DependencyResolver.resolve() tests ───

  describe('resolve() (DependencyResolver)', () => {
    it('should return empty array for empty componentIds', () => {
      const registry = new ModuleRegistry()
      expect(registry.resolve([])).toEqual([])
    })

    it('should return DependencyEdge with correct fields', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['cpp:print']))

      const edges = registry.resolve(['cpp:print'])
      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        directive: '#include <iostream>',
        sourceType: 'stdlib',
        header: '<iostream>',
        reason: 'cpp:print',
      })
    })

    it('should deduplicate edges for same header', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['cpp:print', 'cpp:input', 'cpp:endl']))

      const edges = registry.resolve(['cpp:print', 'cpp:input', 'cpp:endl'])
      expect(edges).toHaveLength(1)
      expect(edges[0].header).toBe('<iostream>')
      expect(edges[0].reason).toBe('cpp:print') // first component wins
    })

    it('should sort edges by header', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['cpp:print']))
      registry.register(createMockModule('<vector>', ['vector_create']))
      registry.register(createMockModule('<algorithm>', ['algorithm_sort']))

      const edges = registry.resolve(['cpp:print', 'vector_create', 'algorithm_sort'])
      expect(edges.map(e => e.header)).toEqual(['<algorithm>', '<iostream>', '<vector>'])
    })

    it('should ignore unknown components', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['cpp:print']))

      const edges = registry.resolve(['cpp:print', 'cpp:if', 'cpp:var_declare', 'unknown'])
      expect(edges).toHaveLength(1)
    })

    it('should produce same header set as old getRequiredHeaders would', () => {
      const registry = new ModuleRegistry()
      registry.register(createMockModule('<iostream>', ['cpp:print', 'cpp:input']))
      registry.register(createMockModule('<vector>', ['vector_create']))
      registry.register(createMockModule('<algorithm>', ['algorithm_sort']))

      const componentIds = ['cpp:print', 'vector_create', 'algorithm_sort', 'cpp:if']
      const edges = registry.resolve(componentIds)
      const headers = edges.map(e => e.header)
      expect(headers).toEqual(['<algorithm>', '<iostream>', '<vector>'])
    })
  })
})
