import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'

describe('Concept/BlockDef split integrity', () => {
  it('should have correct universal concept and block counts', () => {
    expect((universalConcepts as unknown as ConceptDefJSON[]).length).toBe(26)
    expect((universalBlocks as unknown as BlockProjectionJSON[]).length).toBe(26)
  })

  it('should have correct core concept and block counts (42 each)', () => {
    expect(coreConcepts.length).toBe(45)
    expect(coreBlocks.length).toBe(45)
  })

  it('should have valid concepts and blocks arrays for each std module', () => {
    for (const mod of allStdModules) {
      expect(Array.isArray(mod.concepts), `${mod.header} concepts should be array`).toBe(true)
      expect(Array.isArray(mod.blocks), `${mod.header} blocks should be array`).toBe(true)
      // Some modules (iostream, cmath) use universal concepts so their concepts.json is empty
      // But modules with concepts should have matching blocks
      if (mod.concepts.length > 0) {
        expect(mod.blocks.length, `${mod.header} should have blocks if it has concepts`).toBeGreaterThan(0)
      }
    }
  })

  it('should have all concept IDs unique across core + std', () => {
    const allConceptIds: string[] = []
    for (const c of coreConcepts) allConceptIds.push(c.conceptId)
    for (const mod of allStdModules) {
      for (const c of mod.concepts) allConceptIds.push(c.conceptId)
    }
    expect(new Set(allConceptIds).size).toBe(allConceptIds.length)
  })

  it('should have every projection conceptId present in concepts', () => {
    const allConceptIds = new Set([
      ...(universalConcepts as unknown as ConceptDefJSON[]).map(c => c.conceptId),
      ...coreConcepts.map(c => c.conceptId),
      ...allStdModules.flatMap(m => m.concepts).map(c => c.conceptId),
    ])

    const allProjections = [
      ...(universalBlocks as unknown as BlockProjectionJSON[]) as Array<{ conceptId: string }>,
      ...coreBlocks as Array<{ conceptId: string }>,
      ...allStdModules.flatMap(m => m.blocks) as Array<{ conceptId: string }>,
    ]

    for (const proj of allProjections) {
      expect(allConceptIds.has(proj.conceptId), `Missing concept for projection conceptId: ${proj.conceptId}`).toBe(true)
    }
  })

  it('concepts should not contain blockDef field', () => {
    const allConcepts = [
      ...(universalConcepts as unknown as Array<Record<string, unknown>>),
      ...(coreConcepts as unknown as Array<Record<string, unknown>>),
      ...allStdModules.flatMap(m => m.concepts as unknown as Array<Record<string, unknown>>),
    ]

    for (const c of allConcepts) {
      expect(c).not.toHaveProperty('blockDef')
      expect(c).not.toHaveProperty('codeTemplate')
      expect(c).not.toHaveProperty('astPattern')
      expect(c).not.toHaveProperty('renderMapping')
    }
  })

  it('block projections should not contain concept semantic fields', () => {
    const allProjections = [
      ...(universalBlocks as unknown as Array<Record<string, unknown>>),
      ...(coreBlocks as unknown as Array<Record<string, unknown>>),
      ...allStdModules.flatMap(m => m.blocks as unknown as Array<Record<string, unknown>>),
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
