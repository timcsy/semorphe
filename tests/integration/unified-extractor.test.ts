/**
 * Unified Extractor Tests
 *
 * Verifies that PatternExtractor can correctly extract static blocks
 * from BlockState JSON (the same format BlocklyPanel serializes to).
 * This ensures the UI extraction path matches the test extraction path.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { universalConcepts, universalBlocks } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'

let extractor: PatternExtractor

beforeAll(() => {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(
    [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)],
    [...universalBlocks, ...coreBlocks, ...allStdModules.flatMap(m => m.blocks)]
  )
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
})

describe('Unified extractor: static blocks via PatternExtractor', () => {
  it('c_const_declare with VALUE input → cpp_const_declare with initializer', () => {
    const blockState = {
      type: 'c_const_declare',
      id: 'test1',
      fields: { TYPE: 'int', NAME: 'limit' },
      inputs: {
        VALUE: {
          block: {
            type: 'u_arithmetic',
            id: 'test2',
            fields: { OP: '+' },
            inputs: {
              A: { block: { type: 'u_var_ref', id: 'test3', fields: { NAME: 'max' }, inputs: {} } },
              B: { block: { type: 'u_number', id: 'test4', fields: { NUM: '1' }, inputs: {} } },
            },
          },
        },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe('cpp:const_declare')
    expect(result!.properties.type).toBe('int')
    expect(result!.properties.name).toBe('limit')
    expect(result!.children.initializer).toHaveLength(1)
    expect(result!.children.initializer[0].conceptId).toBe('arithmetic')
  })

  it('c_pointer_declare with INIT input → cpp_pointer_declare with initializer', () => {
    const blockState = {
      type: 'c_pointer_declare',
      id: 'test5',
      fields: { TYPE: 'int', NAME: 'ptr' },
      inputs: {
        INIT: {
          block: {
            type: 'c_address_of',
            id: 'test6',
            fields: {},
            inputs: {
              VAR: { block: { type: 'u_var_ref', id: 'test7', fields: { NAME: 'x' }, inputs: {} } },
            },
          },
        },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe('cpp:pointer_declare')
    expect(result!.properties.type).toBe('int')
    expect(result!.properties.name).toBe('ptr')
    expect(result!.children.initializer).toHaveLength(1)
    expect(result!.children.initializer[0].conceptId).toBe('cpp:address_of')
  })

  it('c_ref_declare with INIT input → cpp_ref_declare with initializer', () => {
    const blockState = {
      type: 'c_ref_declare',
      id: 'test8',
      fields: { TYPE: 'int', NAME: 'ref' },
      inputs: {
        INIT: { block: { type: 'u_var_ref', id: 'test9', fields: { NAME: 'x' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe('cpp:ref_declare')
    expect(result!.properties.name).toBe('ref')
    expect(result!.children.initializer).toHaveLength(1)
  })

  it('c_cast with VALUE input → cpp_cast with value child', () => {
    const blockState = {
      type: 'c_cast',
      id: 'test10',
      fields: { TARGET_TYPE: 'int' },
      inputs: {
        VALUE: { block: { type: 'u_number', id: 'test11', fields: { NUM: '3.14' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe('cpp:cast')
    expect(result!.properties.target_type).toBe('int')
    expect(result!.children.value).toHaveLength(1)
  })

  it('u_arithmetic with A/B inputs → arithmetic with left/right children', () => {
    const blockState = {
      type: 'u_arithmetic',
      id: 'test12',
      fields: { OP: '+' },
      inputs: {
        A: { block: { type: 'u_number', id: 'test13', fields: { NUM: '5' }, inputs: {} } },
        B: { block: { type: 'u_number', id: 'test14', fields: { NUM: '3' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe('arithmetic')
    expect(result!.properties.operator).toBe('+')
    expect(result!.children.left).toHaveLength(1)
    expect(result!.children.right).toHaveLength(1)
  })

  it('blocks without registered concept return null (PatternExtractor cannot handle)', () => {
    const blockState = {
      type: 'nonexistent_block',
      id: 'test99',
      fields: {},
      inputs: {},
    }
    const result = extractor.extract(blockState as never)
    expect(result).toBeNull()
  })
})
