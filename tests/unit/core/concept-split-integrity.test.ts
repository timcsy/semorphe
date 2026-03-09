import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const semanticsDir = path.resolve(__dirname, '../../../src/blocks/semantics')
const cppSemanticsDir = path.resolve(__dirname, '../../../src/languages/cpp/semantics')
const universalProjectionsDir = path.resolve(__dirname, '../../../src/blocks/projections/blocks')
const cppProjectionsDir = path.resolve(__dirname, '../../../src/languages/cpp/projections/blocks')

function loadJSON(filePath: string): unknown[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('Concept/BlockDef split integrity', () => {
  it('should have correct total concept count (≥ 83)', () => {
    const universalConcepts = loadJSON(path.join(semanticsDir, 'universal-concepts.json')) as Array<{ conceptId: string }>
    const cppConcepts = loadJSON(path.join(cppSemanticsDir, 'concepts.json')) as Array<{ conceptId: string }>
    expect(universalConcepts.length + cppConcepts.length).toBeGreaterThanOrEqual(83)
  })

  it('should have correct cpp projection count matching original', () => {
    const basic = loadJSON(path.join(cppProjectionsDir, 'basic.json'))
    const advanced = loadJSON(path.join(cppProjectionsDir, 'advanced.json'))
    const special = loadJSON(path.join(cppProjectionsDir, 'special.json'))
    // Original: basic=14, advanced=26, special=17 = 57
    expect(basic.length + advanced.length + special.length).toBe(57)
  })

  it('should have correct universal projection count', () => {
    const universal = loadJSON(path.join(universalProjectionsDir, 'universal-blocks.json'))
    expect(universal.length).toBe(26)
  })

  it('should have every projection conceptId present in concepts', () => {
    const universalConcepts = loadJSON(path.join(semanticsDir, 'universal-concepts.json')) as Array<{ conceptId: string }>
    const cppConcepts = loadJSON(path.join(cppSemanticsDir, 'concepts.json')) as Array<{ conceptId: string }>
    const allConceptIds = new Set([
      ...universalConcepts.map(c => c.conceptId),
      ...cppConcepts.map(c => c.conceptId),
    ])

    const allProjections = [
      ...loadJSON(path.join(universalProjectionsDir, 'universal-blocks.json')) as Array<{ conceptId: string }>,
      ...loadJSON(path.join(cppProjectionsDir, 'basic.json')) as Array<{ conceptId: string }>,
      ...loadJSON(path.join(cppProjectionsDir, 'advanced.json')) as Array<{ conceptId: string }>,
      ...loadJSON(path.join(cppProjectionsDir, 'special.json')) as Array<{ conceptId: string }>,
    ]

    for (const proj of allProjections) {
      expect(allConceptIds.has(proj.conceptId), `Missing concept for projection conceptId: ${proj.conceptId}`).toBe(true)
    }
  })

  it('concepts.json should not contain blockDef field', () => {
    const universalConcepts = loadJSON(path.join(semanticsDir, 'universal-concepts.json')) as Array<Record<string, unknown>>
    const cppConcepts = loadJSON(path.join(cppSemanticsDir, 'concepts.json')) as Array<Record<string, unknown>>

    for (const c of [...universalConcepts, ...cppConcepts]) {
      expect(c).not.toHaveProperty('blockDef')
      expect(c).not.toHaveProperty('codeTemplate')
      expect(c).not.toHaveProperty('astPattern')
      expect(c).not.toHaveProperty('renderMapping')
    }
  })

  it('block-specs.json should not contain concept semantic fields', () => {
    const allProjections = [
      ...loadJSON(path.join(universalProjectionsDir, 'universal-blocks.json')) as Array<Record<string, unknown>>,
      ...loadJSON(path.join(cppProjectionsDir, 'basic.json')) as Array<Record<string, unknown>>,
      ...loadJSON(path.join(cppProjectionsDir, 'advanced.json')) as Array<Record<string, unknown>>,
      ...loadJSON(path.join(cppProjectionsDir, 'special.json')) as Array<Record<string, unknown>>,
    ]

    for (const p of allProjections) {
      // Should have conceptId (reference) but not concept definition fields
      expect(p).toHaveProperty('conceptId')
      expect(p).not.toHaveProperty('properties')
      expect(p).not.toHaveProperty('children')
      expect(p).not.toHaveProperty('role')
    }
  })
})
