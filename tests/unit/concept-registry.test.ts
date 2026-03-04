import { describe, it, expect } from 'vitest'
import { ConceptRegistry } from '../../src/core/concept-registry'

describe('ConceptRegistry', () => {
  it('should have all universal concepts pre-registered', () => {
    const registry = new ConceptRegistry()
    expect(registry.isRegistered('var_declare')).toBe(true)
    expect(registry.isRegistered('func_def')).toBe(true)
    expect(registry.isRegistered('print')).toBe(true)
    expect(registry.isRegistered('array_access')).toBe(true)
    expect(registry.isRegistered('program')).toBe(true)
  })

  it('should list all universal concepts', () => {
    const registry = new ConceptRegistry()
    const universals = registry.getUniversalConcepts()
    expect(universals).toContain('var_declare')
    expect(universals).toContain('func_def')
    expect(universals).toContain('print')
    expect(universals.length).toBe(23)
  })

  it('should register language-specific concepts', () => {
    const registry = new ConceptRegistry()
    registry.registerLanguageSpecific('cpp:include', {
      propertyNames: ['header'],
      childNames: [],
    })
    expect(registry.isRegistered('cpp:include')).toBe(true)
  })

  it('should list language-specific concepts', () => {
    const registry = new ConceptRegistry()
    registry.registerLanguageSpecific('cpp:include', {
      propertyNames: ['header'],
      childNames: [],
    })
    registry.registerLanguageSpecific('cpp:pointer_declare', {
      propertyNames: ['name', 'type'],
      childNames: [],
    })
    const langConcepts = registry.getLanguageSpecificConcepts()
    expect(langConcepts).toContain('cpp:include')
    expect(langConcepts).toContain('cpp:pointer_declare')
    expect(langConcepts.length).toBe(2)
  })

  it('should return false for unregistered concepts', () => {
    const registry = new ConceptRegistry()
    expect(registry.isRegistered('python:list_comprehension')).toBe(false)
  })

  it('should list all registered concepts', () => {
    const registry = new ConceptRegistry()
    registry.registerLanguageSpecific('cpp:include', {
      propertyNames: ['header'],
      childNames: [],
    })
    const all = registry.listAll()
    expect(all.length).toBe(24) // 23 universal + 1 language-specific
    expect(all).toContain('var_declare')
    expect(all).toContain('cpp:include')
  })

  it('should get concept definition', () => {
    const registry = new ConceptRegistry()
    const def = registry.getDefinition('var_declare')
    expect(def).toBeDefined()
    expect(def!.propertyNames).toContain('name')
    expect(def!.propertyNames).toContain('type')
  })

  it('should return undefined for unknown concept definition', () => {
    const registry = new ConceptRegistry()
    expect(registry.getDefinition('unknown_concept')).toBeUndefined()
  })
})
