import { describe, it, expect } from 'vitest'
import { allStdModules, createPopulatedRegistry } from '../../src/languages/cpp/std'

describe('Std module structure consistency', () => {
  it('every std module should have a non-empty header name', () => {
    for (const mod of allStdModules) {
      expect(mod.header).toBeTruthy()
      expect(mod.header.startsWith('<')).toBe(true)
      expect(mod.header.endsWith('>')).toBe(true)
    }
  })

  it('every std module should export registerGenerators function', () => {
    for (const mod of allStdModules) {
      expect(typeof mod.registerGenerators).toBe('function')
    }
  })

  it('every std module should export registerLifters function', () => {
    for (const mod of allStdModules) {
      expect(typeof mod.registerLifters).toBe('function')
    }
  })

  it('concepts and blocks should be arrays', () => {
    for (const mod of allStdModules) {
      expect(Array.isArray(mod.concepts)).toBe(true)
      expect(Array.isArray(mod.blocks)).toBe(true)
    }
  })

  it('all concept IDs should be unique across modules', () => {
    const seen = new Map<string, string>()
    for (const mod of allStdModules) {
      for (const concept of mod.concepts) {
        const existing = seen.get(concept.conceptId)
        if (existing) {
          throw new Error(`Duplicate concept "${concept.conceptId}" in ${mod.header} and ${existing}`)
        }
        seen.set(concept.conceptId, mod.header)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it('all block IDs should be unique across modules', () => {
    const seen = new Map<string, string>()
    for (const mod of allStdModules) {
      for (const block of mod.blocks) {
        const id = (block as any).id
        if (!id) continue
        const existing = seen.get(id)
        if (existing) {
          throw new Error(`Duplicate block "${id}" in ${mod.header} and ${existing}`)
        }
        seen.set(id, mod.header)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it('populated registry should have all module concepts mapped', () => {
    const registry = createPopulatedRegistry()
    for (const mod of allStdModules) {
      for (const concept of mod.concepts) {
        const header = registry.getHeaderForConcept(concept.conceptId)
        expect(header).toBe(mod.header)
      }
    }
  })

  it('populated registry should have universal IO concepts mapped to <iostream>', () => {
    const registry = createPopulatedRegistry()
    expect(registry.getHeaderForConcept('print')).toBe('<iostream>')
    expect(registry.getHeaderForConcept('input')).toBe('<iostream>')
    expect(registry.getHeaderForConcept('endl')).toBe('<iostream>')
  })

  it('should have 13 std modules', () => {
    expect(allStdModules).toHaveLength(13)
    const headers = allStdModules.map(m => m.header).sort()
    expect(headers).toEqual([
      '<algorithm>', '<cctype>', '<cmath>', '<cstdio>', '<cstdlib>', '<cstring>', '<iostream>',
      '<map>', '<queue>', '<set>', '<stack>', '<string>', '<vector>',
    ])
  })
})
