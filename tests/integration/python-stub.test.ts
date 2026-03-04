import { describe, it, expect } from 'vitest'
import type { NewLanguageModule, TypeEntry } from '../../src/languages/types'
import type { ConceptId } from '../../src/core/semantic-model'
import { LanguageRegistryImpl } from '../../src/core/converter'

/**
 * T050: Python stub integration tests
 * Validates that the LanguageModule architecture can support a new language.
 */

describe('T050: Python stub module registration', () => {
  let pyModule: NewLanguageModule

  async function loadPythonModule(): Promise<NewLanguageModule> {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    return new PythonLanguageModule()
  }

  it('should implement NewLanguageModule interface', async () => {
    pyModule = await loadPythonModule()
    expect(pyModule.languageId).toBe('python')
    expect(pyModule.displayNameKey).toBe('LANG_PYTHON')
    expect(typeof pyModule.getTypes).toBe('function')
    expect(typeof pyModule.getSupportedConcepts).toBe('function')
    expect(typeof pyModule.getAdditionalConcepts).toBe('function')
    expect(typeof pyModule.getTooltipOverrides).toBe('function')
  })

  it('should return Python type entries', async () => {
    pyModule = await loadPythonModule()
    const types = pyModule.getTypes()
    expect(types.length).toBeGreaterThan(0)

    const values = types.map(t => t.value)
    expect(values).toContain('int')
    expect(values).toContain('float')
    expect(values).toContain('str')
    expect(values).toContain('bool')
    expect(values).toContain('list')
    expect(values).toContain('dict')

    // Should NOT have C++ types
    expect(values).not.toContain('char')
    expect(values).not.toContain('void')
    expect(values).not.toContain('long long')
  })

  it('should have correct TypeEntry structure', async () => {
    pyModule = await loadPythonModule()
    for (const t of pyModule.getTypes()) {
      expect(t.value).toBeTruthy()
      expect(t.labelKey).toMatch(/^TYPE_PY_/)
      expect(['basic', 'advanced', undefined]).toContain(t.category)
    }
  })
})

describe('T050: Python supported concepts', () => {
  async function loadPythonModule(): Promise<NewLanguageModule> {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    return new PythonLanguageModule()
  }

  it('should support common universal concepts', async () => {
    const pyModule = await loadPythonModule()
    const supported = pyModule.getSupportedConcepts()

    // Python supports these universal concepts
    expect(supported).toContain('var_declare')
    expect(supported).toContain('var_assign')
    expect(supported).toContain('var_ref')
    expect(supported).toContain('if')
    expect(supported).toContain('while_loop')
    expect(supported).toContain('func_def')
    expect(supported).toContain('func_call')
    expect(supported).toContain('return')
    expect(supported).toContain('print')
    expect(supported).toContain('input')
    expect(supported).toContain('arithmetic')
    expect(supported).toContain('compare')
    expect(supported).toContain('logic')
  })

  it('should NOT support C++ specific universal concepts', async () => {
    const pyModule = await loadPythonModule()
    const supported = pyModule.getSupportedConcepts()

    // Python doesn't have these (or they're different enough)
    expect(supported).not.toContain('array_declare')
    expect(supported).not.toContain('array_access')
  })

  it('should return empty additional concepts for stub', async () => {
    const pyModule = await loadPythonModule()
    const additional = pyModule.getAdditionalConcepts()
    expect(additional).toEqual([])
  })
})

describe('T050: Language registry with multiple languages', () => {
  it('should register both C++ and Python modules', async () => {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    const pyModule = new PythonLanguageModule()

    const registry = new LanguageRegistryImpl()

    // Create a minimal mock for C++ since we don't need full CppLanguageModule here
    const cppMock: NewLanguageModule = {
      languageId: 'cpp',
      displayNameKey: 'LANG_CPP',
      getTypes: () => [{ value: 'int', labelKey: 'TYPE_INT', category: 'basic' as const }],
      getSupportedConcepts: () => ['var_declare' as ConceptId],
      getAdditionalConcepts: () => [],
      getTooltipOverrides: () => ({}),
      getBlockSpecs: () => [],
      getGenerator: () => null as any,
      getParser: () => null as any,
      getAdapter: () => null as any,
    }

    registry.register(cppMock)
    registry.register(pyModule)

    const langs = registry.getAvailableLanguages()
    expect(langs).toContain('cpp')
    expect(langs).toContain('python')
  })

  it('should switch active language between C++ and Python', async () => {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    const pyModule = new PythonLanguageModule()

    const registry = new LanguageRegistryImpl()
    const cppMock: NewLanguageModule = {
      languageId: 'cpp',
      displayNameKey: 'LANG_CPP',
      getTypes: () => [
        { value: 'int', labelKey: 'TYPE_INT', category: 'basic' as const },
        { value: 'char', labelKey: 'TYPE_CHAR', category: 'basic' as const },
      ],
      getSupportedConcepts: () => ['var_declare' as ConceptId, 'array_declare' as ConceptId],
      getAdditionalConcepts: () => [],
      getTooltipOverrides: () => ({}),
      getBlockSpecs: () => [],
      getGenerator: () => null as any,
      getParser: () => null as any,
      getAdapter: () => null as any,
    }

    registry.register(cppMock)
    registry.register(pyModule)

    // Start with C++
    registry.setActive('cpp')
    expect(registry.getActive().languageId).toBe('cpp')
    const cppTypes = registry.getActive().getTypes().map(t => t.value)
    expect(cppTypes).toContain('char')

    // Switch to Python
    registry.setActive('python')
    expect(registry.getActive().languageId).toBe('python')
    const pyTypes = registry.getActive().getTypes().map(t => t.value)
    expect(pyTypes).toContain('str')
    expect(pyTypes).not.toContain('char')

    // Switch back to C++
    registry.setActive('cpp')
    expect(registry.getActive().languageId).toBe('cpp')
  })

  it('should change type dropdown entries when switching language', async () => {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    const pyModule = new PythonLanguageModule()

    const registry = new LanguageRegistryImpl()
    const cppMock: NewLanguageModule = {
      languageId: 'cpp',
      displayNameKey: 'LANG_CPP',
      getTypes: () => [
        { value: 'int', labelKey: 'TYPE_INT', category: 'basic' as const },
        { value: 'void', labelKey: 'TYPE_VOID', category: 'basic' as const },
      ],
      getSupportedConcepts: () => [],
      getAdditionalConcepts: () => [],
      getTooltipOverrides: () => ({}),
      getBlockSpecs: () => [],
      getGenerator: () => null as any,
      getParser: () => null as any,
      getAdapter: () => null as any,
    }

    registry.register(cppMock)
    registry.register(pyModule)

    registry.setActive('cpp')
    const cppTypeValues = registry.getActive().getTypes().map(t => t.value)
    expect(cppTypeValues).toContain('void')

    registry.setActive('python')
    const pyTypeValues = registry.getActive().getTypes().map(t => t.value)
    expect(pyTypeValues).not.toContain('void')
    expect(pyTypeValues).toContain('list')
  })
})

describe('T053: Graceful degradation', () => {
  it('should identify unsupported concepts', async () => {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    const pyModule = new PythonLanguageModule()
    const supported = new Set(pyModule.getSupportedConcepts())

    // C++ specific concepts that Python doesn't support
    const cppOnlyConcepts: ConceptId[] = ['array_declare', 'array_access']
    for (const concept of cppOnlyConcepts) {
      expect(supported.has(concept)).toBe(false)
    }
  })

  it('should provide degradation info for unsupported concepts', async () => {
    const { PythonLanguageModule } = await import('../../src/languages/python/module')
    const pyModule = new PythonLanguageModule()

    // getDegradationStrategy should exist
    expect(typeof (pyModule as any).getDegradationStrategy).toBe('function')

    const strategy = (pyModule as any).getDegradationStrategy('array_declare')
    expect(strategy).toBeDefined()
    expect(strategy.level).toBeDefined()
    expect(['approximate', 'raw_code', 'unsupported']).toContain(strategy.level)
  })
})
