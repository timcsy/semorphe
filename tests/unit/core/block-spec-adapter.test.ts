import { describe, it, expect } from 'vitest'
import { mergeToBlockSpecs } from '../../../src/core/block-spec-adapter'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'

const sampleConcepts: ConceptDefJSON[] = [
  {
    conceptId: 'var_declare',
    layer: 'universal',
    level: 0,
    properties: ['type', 'name'],
    children: { init: 'expression' },
    role: 'statement',
  },
  {
    conceptId: 'print',
    layer: 'universal',
    level: 0,
    abstractConcept: null,
    properties: [],
    children: { values: 'expression' },
    role: 'statement',
  },
]

const sampleProjections: BlockProjectionJSON[] = [
  {
    id: 'u_var_declare',
    conceptId: 'var_declare',
    language: 'universal',
    category: 'variables',
    level: 0,
    version: '1.0.0',
    blockDef: { type: 'u_var_declare', message0: 'declare %1 %2' },
    codeTemplate: { pattern: '${type} ${name} = ${init};', imports: [], order: 0 },
    astPattern: { nodeType: 'declaration', constraints: [] },
  },
  {
    id: 'u_print',
    conceptId: 'print',
    language: 'universal',
    category: 'io',
    level: 0,
    version: '1.0.0',
    blockDef: { type: 'u_print', message0: 'print %1' },
    codeTemplate: { pattern: 'cout << ${values};', imports: ['<iostream>'], order: 0 },
    astPattern: { nodeType: 'call_expression', constraints: [] },
  },
]

describe('mergeToBlockSpecs', () => {
  it('should merge concept + projection into complete BlockSpec', () => {
    const result = mergeToBlockSpecs(sampleConcepts, sampleProjections)
    expect(result).toHaveLength(2)

    const varDecl = result.find(s => s.id === 'u_var_declare')!
    expect(varDecl.concept.conceptId).toBe('var_declare')
    expect(varDecl.concept.properties).toEqual(['type', 'name'])
    expect(varDecl.concept.children).toEqual({ init: 'expression' })
    expect(varDecl.concept.role).toBe('statement')
    expect(varDecl.blockDef).toEqual({ type: 'u_var_declare', message0: 'declare %1 %2' })
    expect(varDecl.codeTemplate.pattern).toBe('${type} ${name} = ${init};')
  })

  it('should handle projection without matching concept', () => {
    const orphanProjection: BlockProjectionJSON[] = [
      {
        id: 'orphan_block',
        conceptId: 'nonexistent_concept',
        language: 'cpp',
        category: 'misc',
        level: 0,
        version: '1.0.0',
        blockDef: { type: 'orphan_block' },
      },
    ]
    const result = mergeToBlockSpecs([], orphanProjection)
    expect(result).toHaveLength(1)
    expect(result[0].concept.conceptId).toBe('nonexistent_concept')
    expect(result[0].concept.properties).toBeUndefined()
  })

  it('should produce same count as projections', () => {
    const result = mergeToBlockSpecs(sampleConcepts, sampleProjections)
    expect(result).toHaveLength(sampleProjections.length)
  })
})
