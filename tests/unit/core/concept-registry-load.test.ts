import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ConceptRegistry } from '../../../src/core/concept-registry'
import type { ConceptDefJSON } from '../../../src/core/types'
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import { coreConcepts } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'

function loadConcepts(): ConceptDefJSON[] {
  return [
    ...universalConcepts as unknown as ConceptDefJSON[],
    ...coreConcepts,
    ...allStdModules.flatMap(m => m.concepts),
  ]
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
