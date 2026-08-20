import { describe, it, expect, beforeEach } from 'vitest'
import { ComponentRegistry } from '../../../src/core/component-registry'
import type { ComponentDef } from '../../../src/core/types'

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry

  beforeEach(() => {
    registry = new ComponentRegistry()
  })

  describe('register and get', () => {
    it('should register and retrieve a concept', () => {
      const def: ComponentDef = {
        id: 'cpp:var_declare',
        layer: 'universal',
        propertyNames: ['name', 'type'],
        childNames: ['initializer'],
      }
      registry.register(def)
      expect(registry.get('cpp:var_declare')).toEqual(def)
    })

    it('should throw on duplicate registration', () => {
      const def: ComponentDef = {
        id: 'cpp:var_declare',
        layer: 'universal',
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

  // 🔄 **spec 152 移除**：這一組測的是 `listByLayer()`／`layer` 欄位本身，
  //    而那一格已退場（233 顆元件宣告它，生產路徑零消費者）。
  //    ⚠️ 它們用的是**合成資料**——紅掉不是「我漏了消費者」，
  //    是「被測的功能不存在了」。判準見 `specs/152-retire-layer/spec.md` US1。


  describe('findAbstract', () => {
    it('should find the abstract concept for a concrete concept', () => {
      registry.register({
        id: 'collection_sort', layer: 'universal',
        propertyNames: [], childNames: [],
      })
      registry.register({
        id: 'cpp:stdlib:sort', layer: 'lang-library',
        abstractConcept: 'collection_sort',
        propertyNames: [], childNames: [],
      })

      const abstract = registry.findAbstract('cpp:stdlib:sort')
      expect(abstract).toBeTruthy()
      expect(abstract?.id).toBe('collection_sort')
    })

    it('should return undefined if no abstract mapping', () => {
      registry.register({
        id: 'cpp:var_declare', layer: 'universal',
        propertyNames: [], childNames: [],
      })
      expect(registry.findAbstract('cpp:var_declare')).toBeUndefined()
    })
  })

  describe('annotations', () => {
    it('should return annotation value for registered concept', () => {
      registry.register({
        id: 'for_loop', layer: 'universal',
        propertyNames: [], childNames: ['body'],
        annotations: { control_flow: 'loop', introduces_scope: true, cognitive_level: 1 },
      })
      expect(registry.getAnnotation('for_loop', 'control_flow')).toBe('loop')
      expect(registry.getAnnotation('for_loop', 'introduces_scope')).toBe(true)
      expect(registry.getAnnotation('for_loop', 'cognitive_level')).toBe(1)
    })

    it('should return undefined for missing annotation key', () => {
      registry.register({
        id: 'cpp:if', layer: 'universal',
        propertyNames: [], childNames: [],
        annotations: { control_flow: 'branch' },
      })
      expect(registry.getAnnotation('cpp:if', 'hardware_binding')).toBeUndefined()
    })

    it('should return undefined for unregistered concept', () => {
      expect(registry.getAnnotation('nonexistent', 'control_flow')).toBeUndefined()
    })

    it('should return undefined when concept has no annotations', () => {
      registry.register({
        id: 'cpp:var_ref', layer: 'universal',
        propertyNames: ['name'], childNames: [],
      })
      expect(registry.getAnnotation('cpp:var_ref', 'control_flow')).toBeUndefined()
    })

    it('should use latest annotations when concept is re-registered', () => {
      // First registration
      registry.register({
        id: 'test_concept', layer: 'universal',
        propertyNames: [], childNames: [],
        annotations: { old_key: 'old_value' },
      })
      expect(registry.getAnnotation('test_concept', 'old_key')).toBe('old_value')

      // Re-register with different annotations (using registerOrUpdate)
      registry.registerOrUpdate({
        id: 'test_concept', layer: 'universal',
        propertyNames: [], childNames: [],
        annotations: { new_key: 'new_value' },
      })
      expect(registry.getAnnotation('test_concept', 'new_key')).toBe('new_value')
      expect(registry.getAnnotation('test_concept', 'old_key')).toBeUndefined()
    })
  })
})
