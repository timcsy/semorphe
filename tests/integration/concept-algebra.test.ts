import { describe, it, expect, beforeEach } from 'vitest'
import { ConceptRegistry } from '../../src/core/concept-registry'
import type { ConceptDef } from '../../src/core/types'

describe('Concept Algebra (US8)', () => {
  let registry: ConceptRegistry

  beforeEach(() => {
    registry = new ConceptRegistry()

    // Universal layer
    registry.register({
      id: 'container_add',
      layer: 'universal',
      propertyNames: ['container'],
      childNames: ['value'],
    })
    registry.register({
      id: 'container_sort',
      layer: 'universal',
      propertyNames: ['container'],
      childNames: ['from', 'to'],
    })
    registry.register({
      id: 'container_size',
      layer: 'universal',
      propertyNames: ['container'],
      childNames: [],
    })

    // Lang-core layer
    registry.register({
      id: 'cpp:var_declare',
      layer: 'lang-core',
      propertyNames: ['name', 'type'],
      childNames: ['initializer'],
    })

    // Lang-library layer (C++ specific)
    registry.register({
      id: 'cpp:vector_push_back',
      layer: 'lang-library',
      abstractConcept: 'container_add',
      propertyNames: ['name'],
      childNames: ['value'],
    })
    registry.register({
      id: 'cpp:range_sort',
      layer: 'lang-library',
      abstractConcept: 'container_sort',
      propertyNames: ['array'],
      childNames: ['from', 'to'],
    })
    registry.register({
      id: 'cpp:vector_size',
      layer: 'lang-library',
      abstractConcept: 'container_size',
      propertyNames: ['name'],
      childNames: [],
    })
  })

  describe('Three-layer queries', () => {
    it('should list universal layer concepts', () => {
      const universal = registry.listByLayer('universal')
      expect(universal).toHaveLength(3)
      expect(universal.map(c => c.id)).toContain('container_add')
    })

    it('should list lang-library concepts', () => {
      const lib = registry.listByLayer('lang-library')
      expect(lib).toHaveLength(3)
      expect(lib.map(c => c.id)).toContain('cpp:vector_push_back')
    })

    it('should list lang-core concepts', () => {
      const core = registry.listByLayer('lang-core')
      expect(core).toHaveLength(1)
      expect(core[0].id).toBe('cpp:var_declare')
    })
  })

  describe('Abstract concept mapping', () => {
    it('should find abstract concept for cpp:vector_push_back', () => {
      const abstract = registry.findAbstract('cpp:vector_push_back')
      expect(abstract).toBeDefined()
      expect(abstract!.id).toBe('container_add')
      expect(abstract!.layer).toBe('universal')
    })

    it('should find abstract concept for cpp:sort', () => {
      const abstract = registry.findAbstract('cpp:range_sort')
      expect(abstract).toBeDefined()
      expect(abstract!.id).toBe('container_sort')
    })

    it('should return undefined for concept without abstract', () => {
      expect(registry.findAbstract('cpp:var_declare')).toBeUndefined()
    })

    it('should return undefined for unknown concept', () => {
      expect(registry.findAbstract('nonexistent')).toBeUndefined()
    })
  })

  describe('Layer-based filtering', () => {
    it('should list only universal layer concepts', () => {
      const universal = registry.listByLayer('universal')
      expect(universal).toHaveLength(3)
      expect(universal.map(c => c.id)).toContain('container_add')
      expect(universal.map(c => c.id)).not.toContain('cpp:var_declare')
    })

    it('should list only lang-core layer concepts', () => {
      const core = registry.listByLayer('lang-core')
      expect(core).toHaveLength(1)
      expect(core.map(c => c.id)).toContain('cpp:var_declare')
    })

    it('should list all lang-library concepts', () => {
      const lib = registry.listByLayer('lang-library')
      expect(lib).toHaveLength(3)
    })

    it('lang-library concept should not appear in universal layer', () => {
      const universal = registry.listByLayer('universal')
      expect(universal.map(c => c.id)).not.toContain('cpp:vector_push_back')
    })
  })
})
