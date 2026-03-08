import { describe, it, expect, beforeAll } from 'vitest'
import type { NewLanguageModule, TypeEntry } from '../../src/languages/types'
import type { ConceptId } from '../../src/core/types'

/**
 * T033: LanguageModule integration tests
 * Tests use a mock module first, then verify CppLanguageModule after T035.
 * For now, tests verify the interface contract and type system.
 */

/** Minimal mock LanguageModule for testing the interface contract */
class MockLanguageModule implements NewLanguageModule {
  readonly languageId = 'mock-lang'
  readonly displayNameKey = 'LANG_MOCK'

  getTypes(): TypeEntry[] {
    return [
      { value: 'int', labelKey: 'TYPE_INT', category: 'basic' },
      { value: 'float', labelKey: 'TYPE_FLOAT', category: 'basic' },
      { value: 'string', labelKey: 'TYPE_STRING', category: 'basic' },
      { value: 'void', labelKey: 'TYPE_VOID', category: 'basic' },
    ]
  }

  getSupportedConcepts(): ConceptId[] {
    return ['var_declare', 'var_assign', 'if', 'while_loop', 'func_def', 'func_call', 'print', 'input']
  }

  getAdditionalConcepts() { return [] }

  getTooltipOverrides(): Record<string, string> {
    return {
      'U_PRINT_TOOLTIP': 'Mock print tooltip override',
    }
  }

  getBlockSpecs() { return [] }
  getGenerator(): any { return null }
  getParser(): any { return null }
  getAdapter(): any { return null }
}

describe('T033: LanguageModule Interface', () => {
  let module: NewLanguageModule

  beforeAll(() => {
    module = new MockLanguageModule()
  })

  it('should have a unique languageId', () => {
    expect(module.languageId).toBe('mock-lang')
  })

  it('should have a display name i18n key', () => {
    expect(module.displayNameKey).toBeTruthy()
  })

  it('should return type entries with value, labelKey, and category', () => {
    const types = module.getTypes()
    expect(types.length).toBeGreaterThan(0)
    for (const t of types) {
      expect(t.value).toBeTruthy()
      expect(t.labelKey).toBeTruthy()
      expect(['basic', 'advanced', undefined]).toContain(t.category)
    }
  })

  it('should return supported universal concepts', () => {
    const concepts = module.getSupportedConcepts()
    expect(concepts).toContain('var_declare')
    expect(concepts).toContain('if')
    expect(concepts).toContain('func_def')
  })

  it('should return tooltip overrides as key-value pairs', () => {
    const overrides = module.getTooltipOverrides()
    expect(typeof overrides).toBe('object')
    for (const [key, value] of Object.entries(overrides)) {
      expect(typeof key).toBe('string')
      expect(typeof value).toBe('string')
    }
  })
})

describe('T033: LanguageRegistry contract', () => {
  it('should register and retrieve modules', async () => {
    // Import the actual LanguageRegistry when it exists (T036)
    // For now, test with a simple Map-based implementation
    const registry = new Map<string, NewLanguageModule>()
    const module = new MockLanguageModule()

    registry.set(module.languageId, module)
    expect(registry.get('mock-lang')).toBe(module)
    expect(registry.has('mock-lang')).toBe(true)
    expect(registry.has('nonexistent')).toBe(false)
  })

  it('should list available languages', () => {
    const registry = new Map<string, NewLanguageModule>()
    const module = new MockLanguageModule()
    registry.set(module.languageId, module)

    const languages = Array.from(registry.keys())
    expect(languages).toContain('mock-lang')
  })
})

describe('T033: Type injection flow', () => {
  it('should provide types that can be injected into Blockly.Msg', () => {
    const module = new MockLanguageModule()
    const msg: Record<string, string> = {}

    // Simulate type label injection
    for (const type of module.getTypes()) {
      msg[type.labelKey] = `${type.value} (translated)`
    }

    expect(msg['TYPE_INT']).toBe('int (translated)')
    expect(msg['TYPE_FLOAT']).toBe('float (translated)')
  })

  it('should provide tooltip overrides that can replace Blockly.Msg entries', () => {
    const module = new MockLanguageModule()
    const msg: Record<string, string> = {
      'U_PRINT_TOOLTIP': 'Original tooltip',
    }

    // Apply overrides
    const overrides = module.getTooltipOverrides()
    for (const [key, value] of Object.entries(overrides)) {
      msg[key] = value
    }

    expect(msg['U_PRINT_TOOLTIP']).toBe('Mock print tooltip override')
  })
})

describe('T033: Concept filtering', () => {
  it('should filter toolbox blocks based on supported concepts', () => {
    const module = new MockLanguageModule()
    const supported = new Set(module.getSupportedConcepts())

    // Simulate concept-based filtering
    const allConcepts: ConceptId[] = ['var_declare', 'pointer_declare', 'if', 'template_func']
    const filtered = allConcepts.filter(c => supported.has(c))

    expect(filtered).toContain('var_declare')
    expect(filtered).toContain('if')
    expect(filtered).not.toContain('pointer_declare')
    expect(filtered).not.toContain('template_func')
  })
})
