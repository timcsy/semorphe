import { describe, it, expect, beforeEach } from 'vitest'
import { ComponentRegistry } from '../../src/core/component-registry'
import type { ComponentDef } from '../../src/core/types'

describe('Component Algebra (US8)', () => {
  let registry: ComponentRegistry

  beforeEach(() => {
    registry = new ComponentRegistry()

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
      abstractComponent: 'container_add',
      propertyNames: ['name'],
      childNames: ['value'],
    })
    registry.register({
      id: 'cpp:range_sort',
      layer: 'lang-library',
      abstractComponent: 'container_sort',
      propertyNames: ['array'],
      childNames: ['from', 'to'],
    })
    registry.register({
      id: 'cpp:vector_size',
      layer: 'lang-library',
      abstractComponent: 'container_size',
      propertyNames: ['name'],
      childNames: [],
    })
  })

  // 🔄 **spec 152 移除**：這一組測的是 `listByLayer()`／`layer` 欄位本身，
  //    而那一格已退場（233 顆元件宣告它，生產路徑零消費者）。
  //    ⚠️ 它們用的是**合成資料**——紅掉不是「我漏了消費者」，
  //    是「被測的功能不存在了」。判準見 `specs/152-retire-layer/spec.md` US1。


  describe('Abstract component mapping', () => {
    it('should find abstract component for cpp:vector_push_back', () => {
      const abstract = registry.findAbstract('cpp:vector_push_back')
      expect(abstract).toBeDefined()
      expect(abstract!.id).toBe('container_add')
      expect(abstract!.layer).toBe('universal')
    })

    it('should find abstract component for cpp:sort', () => {
      const abstract = registry.findAbstract('cpp:range_sort')
      expect(abstract).toBeDefined()
      expect(abstract!.id).toBe('container_sort')
    })

    it('should return undefined for component without abstract', () => {
      expect(registry.findAbstract('cpp:var_declare')).toBeUndefined()
    })

    it('should return undefined for unknown component', () => {
      expect(registry.findAbstract('nonexistent')).toBeUndefined()
    })
  })

  // 🔄 **spec 152 移除**：這一組測的是 `listByLayer()`／`layer` 欄位本身，
  //    而那一格已退場（233 顆元件宣告它，生產路徑零消費者）。
  //    ⚠️ 它們用的是**合成資料**——紅掉不是「我漏了消費者」，
  //    是「被測的功能不存在了」。判準見 `specs/152-retire-layer/spec.md` US1。

})
