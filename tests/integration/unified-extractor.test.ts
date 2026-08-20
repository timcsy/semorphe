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
// ⚠️ **第十五個「自己列舉來源」的地方**（今天的同一個形狀）。
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { componentComponents, componentBlocks } from '../../src/core/component/registry'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'

let extractor: PatternExtractor

beforeAll(() => {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(
    [...universalComponents, ...coreComponents, ...allStdModules.flatMap(m => m.components), ...(componentComponents() as unknown as ComponentDefJSON[])],
    [...universalBlocks, ...coreBlocks, ...allStdModules.flatMap(m => m.blocks), ...(componentBlocks() as BlockProjectionJSON[])]
  )
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
})

describe('Unified extractor: static blocks via PatternExtractor', () => {
  it('cpp_var_declare_const with VALUE input → cpp_const_declare with initializer', () => {
    const blockState = {
      type: 'cpp_var_declare_const',
      id: 'test1',
      fields: { TYPE: 'int', NAME: 'limit' },
      inputs: {
        VALUE: {
          block: {
            type: 'cpp_arithmetic',
            id: 'test2',
            fields: { OP: '+' },
            inputs: {
              A: { block: { type: 'cpp_var_ref', id: 'test3', fields: { NAME: 'max' }, inputs: {} } },
              B: { block: { type: 'cpp_literal_number', id: 'test4', fields: { NUM: '1' }, inputs: {} } },
            },
          },
        },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:var_declare_const')
    expect(result!.properties.type).toBe('int')
    expect(result!.properties.name).toBe('limit')
    expect(result!.children.initializer).toHaveLength(1)
    expect(result!.children.initializer[0].componentId).toBe('cpp:arithmetic')
  })

  it('cpp_pointer_declare with INIT input → cpp_pointer_declare with initializer', () => {
    const blockState = {
      type: 'cpp_pointer_declare',
      id: 'test5',
      fields: { TYPE: 'int', NAME: 'ptr' },
      inputs: {
        INIT: {
          block: {
            type: 'cpp_address_of',
            id: 'test6',
            fields: {},
            inputs: {
              VAR: { block: { type: 'cpp_var_ref', id: 'test7', fields: { NAME: 'x' }, inputs: {} } },
            },
          },
        },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:pointer_declare')
    expect(result!.properties.type).toBe('int')
    expect(result!.properties.name).toBe('ptr')
    expect(result!.children.initializer).toHaveLength(1)
    expect(result!.children.initializer[0].componentId).toBe('cpp:address_of')
  })

  it('cpp_var_declare_ref with INIT input → cpp_ref_declare with initializer', () => {
    const blockState = {
      type: 'cpp_var_declare_ref',
      id: 'test8',
      fields: { TYPE: 'int', NAME: 'ref' },
      inputs: {
        INIT: { block: { type: 'cpp_var_ref', id: 'test9', fields: { NAME: 'x' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:var_declare_ref')
    expect(result!.properties.name).toBe('ref')
    expect(result!.children.initializer).toHaveLength(1)
  })

  it('cpp_cast with VALUE input → cpp_cast with value child', () => {
    const blockState = {
      type: 'cpp_cast',
      id: 'test10',
      fields: { TARGET_TYPE: 'int' },
      inputs: {
        VALUE: { block: { type: 'cpp_literal_number', id: 'test11', fields: { NUM: '3.14' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:cast')
    expect(result!.properties.target_type).toBe('int')
    expect(result!.children.value).toHaveLength(1)
  })

  it('cpp_arithmetic with A/B inputs → arithmetic with left/right children', () => {
    const blockState = {
      type: 'cpp_arithmetic',
      id: 'test12',
      fields: { OP: '+' },
      inputs: {
        A: { block: { type: 'cpp_literal_number', id: 'test13', fields: { NUM: '5' }, inputs: {} } },
        B: { block: { type: 'cpp_literal_number', id: 'test14', fields: { NUM: '3' }, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:arithmetic')
    expect(result!.properties.operator).toBe('+')
    expect(result!.children.left).toHaveLength(1)
    expect(result!.children.right).toHaveLength(1)
  })

  it('blocks without registered component return null (PatternExtractor cannot handle)', () => {
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
