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

  it('should return required headers for concept list', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['print', 'input']))
    registry.register(createMockModule('<vector>', ['vector_create']))
    registry.register(createMockModule('<algorithm>', ['algorithm_sort']))

    const headers = registry.getRequiredHeaders(['print', 'vector_create', 'algorithm_sort', 'if'])
    expect(headers).toEqual(['<algorithm>', '<iostream>', '<vector>'])
  })

  it('should deduplicate headers', () => {
    const registry = new ModuleRegistry()
    registry.register(createMockModule('<iostream>', ['print', 'input', 'endl']))

    const headers = registry.getRequiredHeaders(['print', 'input', 'endl'])
    expect(headers).toEqual(['<iostream>'])
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
})
