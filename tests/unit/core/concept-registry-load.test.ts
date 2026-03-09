import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ConceptRegistry } from '../../../src/core/concept-registry'
import type { ConceptDefJSON } from '../../../src/core/types'

const semanticsDir = path.resolve(__dirname, '../../../src/blocks/semantics')
const cppSemanticsDir = path.resolve(__dirname, '../../../src/languages/cpp/semantics')

function loadConcepts(): ConceptDefJSON[] {
  const universal = JSON.parse(fs.readFileSync(path.join(semanticsDir, 'universal-concepts.json'), 'utf-8'))
  const cpp = JSON.parse(fs.readFileSync(path.join(cppSemanticsDir, 'concepts.json'), 'utf-8'))
  return [...universal, ...cpp]
}

describe('ConceptRegistry.loadFromJSON', () => {
  it('should load correct number of concepts', () => {
    const registry = new ConceptRegistry()
    const concepts = loadConcepts()
    registry.loadFromJSON(concepts)
    expect(registry.listAll().length).toBe(concepts.length)
  })

  it('should load var_declare with correct properties and children', () => {
    const registry = new ConceptRegistry()
    registry.loadFromJSON(loadConcepts())
    const varDecl = registry.get('var_declare')
    expect(varDecl).toBeDefined()
    expect(varDecl!.propertyNames).toContain('type')
    expect(varDecl!.propertyNames).toContain('name')
    expect(varDecl!.childNames).toContain('init')
  })

  it('should filter by level correctly', () => {
    const registry = new ConceptRegistry()
    registry.loadFromJSON(loadConcepts())
    const l0 = registry.listByLevel(0)
    const all = registry.listAll()
    expect(l0.length).toBeGreaterThan(0)
    expect(l0.length).toBeLessThanOrEqual(all.length)
    for (const c of l0) {
      expect(c.level).toBeLessThanOrEqual(0)
    }
  })

  it('concept-registry.ts should not import blockly (static analysis)', () => {
    const filePath = path.resolve(__dirname, '../../../src/core/concept-registry.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain("from 'blockly'")
    expect(content).not.toContain('from "blockly"')
  })
})
