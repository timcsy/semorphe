import { describe, it, expect, beforeEach } from 'vitest'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import type { BlockSpec } from '../../../src/core/types'

const sampleSpec: BlockSpec = {
  id: 'cpp_var_declare',
  language: 'universal',
  category: 'variables',
  version: '1.0.0',
  componentMapping: { componentId: 'cpp:var_declare' },
  blockDef: { type: 'cpp_var_declare', message0: 'declare %1 %2', colour: '#FF8C1A' },
  codeTemplate: { pattern: '${TYPE} ${NAME};', imports: [], order: 0 },
  astPattern: { nodeType: 'declaration', constraints: [] },
}

const sortSpec: BlockSpec = {
  id: 'cpp:stdlib:sort',
  language: 'cpp',
  category: 'algorithms',
  version: '1.0.0',
  componentMapping: { componentId: 'cpp:stdlib:sort', abstractConcept: 'collection_sort' },
  blockDef: { type: 'cpp_range_sort', message0: 'sort %1 to %2', colour: '#4C97FF' },
  codeTemplate: { pattern: 'sort(${BEGIN}, ${END});', imports: ['algorithm'], order: 0 },
  astPattern: {
    nodeType: 'call_expression',
    constraints: [{ field: 'function', text: 'sort' }],
  },
}

describe('BlockSpecRegistry', () => {
  let registry: BlockSpecRegistry

  beforeEach(() => {
    registry = new BlockSpecRegistry()
  })

  describe('loadFromJSON', () => {
    it('should load block specs from array', () => {
      registry.loadFromJSON([sampleSpec, sortSpec])
      expect(registry.getByConceptId('cpp:var_declare')).toEqual(sampleSpec)
      expect(registry.getByConceptId('cpp:stdlib:sort')).toEqual(sortSpec)
    })
  })

  describe('getByConceptId', () => {
    it('should find spec by concept id', () => {
      registry.loadFromJSON([sampleSpec])
      const found = registry.getByConceptId('cpp:var_declare')
      expect(found).toBeTruthy()
      expect(found?.id).toBe('cpp_var_declare')
    })

    it('should return undefined for unknown concept', () => {
      expect(registry.getByConceptId('nonexistent')).toBeUndefined()
    })
  })

  describe('getByAstPattern', () => {
    it('should find specs matching AST node type', () => {
      registry.loadFromJSON([sampleSpec, sortSpec])
      const matches = registry.getByAstPattern('call_expression', [
        { field: 'function', text: 'sort' },
      ])
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('cpp:stdlib:sort')
    })

    it('should return empty for no matches', () => {
      registry.loadFromJSON([sampleSpec])
      const matches = registry.getByAstPattern('unknown_type', [])
      expect(matches).toHaveLength(0)
    })

    it('should match by node type without constraints', () => {
      registry.loadFromJSON([sampleSpec])
      const matches = registry.getByAstPattern('declaration', [])
      expect(matches).toHaveLength(1)
    })
  })

  describe('listByCategory', () => {
    it('should list specs by category with visibleConcepts filter', () => {
      registry.loadFromJSON([sampleSpec, sortSpec])

      const allVars = registry.listByCategory('variables')
      expect(allVars).toHaveLength(1)

      const filteredAlgos = registry.listByCategory('algorithms', new Set(['cpp:var_declare']))
      expect(filteredAlgos).toHaveLength(0)

      const visibleAlgos = registry.listByCategory('algorithms', new Set(['cpp:stdlib:sort']))
      expect(visibleAlgos).toHaveLength(1)
    })
  })
})
