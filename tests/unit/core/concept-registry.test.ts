import { describe, it, expect, beforeEach } from 'vitest'
import { ConceptRegistry } from '../../../src/core/concept-registry'
import type { ConceptDef } from '../../../src/core/types'

describe('ConceptRegistry', () => {
  let registry: ConceptRegistry

  beforeEach(() => {
    registry = new ConceptRegistry()
  })

  describe('register and get', () => {
    it('should register and retrieve a concept', () => {
      const def: ConceptDef = {
        id: 'var_declare',
        layer: 'universal',
        level: 0,
        propertyNames: ['name', 'type'],
        childNames: ['initializer'],
      }
      registry.register(def)
      expect(registry.get('var_declare')).toEqual(def)
    })

    it('should throw on duplicate registration', () => {
      const def: ConceptDef = {
        id: 'var_declare',
        layer: 'universal',
        level: 0,
        propertyNames: ['name'],
        childNames: [],
      }
      registry.register(def)
      expect(() => registry.register(def)).toThrow()
    })

    it('should return undefined for unregistered concept', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('listByLayer', () => {
    it('should list concepts by layer', () => {
      registry.register({
        id: 'var_declare', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
      })
      registry.register({
        id: 'cpp:pointer_deref', layer: 'lang-core', level: 1,
        propertyNames: [], childNames: ['operand'],
      })
      registry.register({
        id: 'cpp:stdlib:sort', layer: 'lang-library', level: 2,
        abstractConcept: 'collection_sort',
        propertyNames: [], childNames: ['begin', 'end'],
      })

      expect(registry.listByLayer('universal')).toHaveLength(1)
      expect(registry.listByLayer('lang-core')).toHaveLength(1)
      expect(registry.listByLayer('lang-library')).toHaveLength(1)
    })
  })

  describe('listByLevel', () => {
    it('should list concepts at or below given level', () => {
      registry.register({
        id: 'var_declare', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
      })
      registry.register({
        id: 'cpp:switch', layer: 'lang-core', level: 1,
        propertyNames: [], childNames: [],
      })
      registry.register({
        id: 'cpp:stdlib:sort', layer: 'lang-library', level: 2,
        propertyNames: [], childNames: [],
      })

      const l0 = registry.listByLevel(0)
      expect(l0).toHaveLength(1)
      expect(l0[0].id).toBe('var_declare')

      const l1 = registry.listByLevel(1)
      expect(l1).toHaveLength(2)

      const l2 = registry.listByLevel(2)
      expect(l2).toHaveLength(3)
    })
  })

  describe('findAbstract', () => {
    it('should find the abstract concept for a concrete concept', () => {
      registry.register({
        id: 'collection_sort', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
      })
      registry.register({
        id: 'cpp:stdlib:sort', layer: 'lang-library', level: 2,
        abstractConcept: 'collection_sort',
        propertyNames: [], childNames: [],
      })

      const abstract = registry.findAbstract('cpp:stdlib:sort')
      expect(abstract).toBeTruthy()
      expect(abstract?.id).toBe('collection_sort')
    })

    it('should return undefined if no abstract mapping', () => {
      registry.register({
        id: 'var_declare', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
      })
      expect(registry.findAbstract('var_declare')).toBeUndefined()
    })
  })

  describe('annotations', () => {
    it('should return annotation value for registered concept', () => {
      registry.register({
        id: 'for_loop', layer: 'universal', level: 1,
        propertyNames: [], childNames: ['body'],
        annotations: { control_flow: 'loop', introduces_scope: true, cognitive_level: 1 },
      })
      expect(registry.getAnnotation('for_loop', 'control_flow')).toBe('loop')
      expect(registry.getAnnotation('for_loop', 'introduces_scope')).toBe(true)
      expect(registry.getAnnotation('for_loop', 'cognitive_level')).toBe(1)
    })

    it('should return undefined for missing annotation key', () => {
      registry.register({
        id: 'if', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
        annotations: { control_flow: 'branch' },
      })
      expect(registry.getAnnotation('if', 'hardware_binding')).toBeUndefined()
    })

    it('should return undefined for unregistered concept', () => {
      expect(registry.getAnnotation('nonexistent', 'control_flow')).toBeUndefined()
    })

    it('should return undefined when concept has no annotations', () => {
      registry.register({
        id: 'var_ref', layer: 'universal', level: 0,
        propertyNames: ['name'], childNames: [],
      })
      expect(registry.getAnnotation('var_ref', 'control_flow')).toBeUndefined()
    })

    it('should use latest annotations when concept is re-registered', () => {
      // First registration
      registry.register({
        id: 'test_concept', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
        annotations: { old_key: 'old_value' },
      })
      expect(registry.getAnnotation('test_concept', 'old_key')).toBe('old_value')

      // Re-register with different annotations (using registerOrUpdate)
      registry.registerOrUpdate({
        id: 'test_concept', layer: 'universal', level: 0,
        propertyNames: [], childNames: [],
        annotations: { new_key: 'new_value' },
      })
      expect(registry.getAnnotation('test_concept', 'new_key')).toBe('new_value')
      expect(registry.getAnnotation('test_concept', 'old_key')).toBeUndefined()
    })
  })
})
