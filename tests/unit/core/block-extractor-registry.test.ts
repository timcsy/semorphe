import { describe, it, expect } from 'vitest'
import { createNode } from '../../../src/core/semantic-tree'
import { PatternExtractor } from '../../../src/core/projection/pattern-extractor'
import type { ExtractStrategyFn, BlockState } from '../../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../../src/languages/cpp/extractors/extract-strategies'

describe('PatternExtractor — extractStrategy', () => {
  it('should register and invoke extraction strategies', () => {
    const extractor = new PatternExtractor()
    const fn: ExtractStrategyFn = () => createNode('test', {})
    extractor.registerExtractStrategy('u_test', fn)

    const block: BlockState = {
      type: 'u_test',
      id: 'b1',
      fields: {},
      inputs: {},
    }
    const result = extractor.extract(block)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('test')
  })

  it('should return null for block types without strategy or spec', () => {
    const extractor = new PatternExtractor()
    const block: BlockState = {
      type: 'not_registered',
      id: 'b1',
      fields: {},
      inputs: {},
    }
    expect(extractor.extract(block)).toBeNull()
  })

  it('strategy takes priority over auto-derive spec', () => {
    const extractor = new PatternExtractor()
    // Load a spec that would auto-derive
    extractor.loadBlockSpecs([{
      blockDef: { type: 'u_test', args0: [{ type: 'field_input', name: 'NAME' }] },
      componentMapping: { componentId: 'test', properties: ['name'], children: {} },
    }])
    // Register strategy that returns different concept
    extractor.registerExtractStrategy('u_test', () => createNode('strategy_wins', {}))

    const block: BlockState = {
      type: 'u_test',
      id: 'b1',
      fields: { NAME: 'hello' },
      inputs: {},
    }
    const result = extractor.extract(block)
    expect(result!.componentId).toBe('strategy_wins')
  })
})

describe('C++ extract strategies on PatternExtractor', () => {
  it('should register strategies for blocks with complex logic', () => {
    const extractor = new PatternExtractor()
    registerCppExtractStrategies(extractor)

    // Verify each block type produces a valid result with minimal input
    const specialTypes = [
      'cpp_var_declare',
      'cpp_if',
      'cpp_if_else',
      'cpp_input',
      'cpp_input_expression',
      'cpp_doc_comment',
      'cpp_var_declare_expression',
    ]
    for (const type of specialTypes) {
      const block: BlockState = {
        type,
        id: `test_${type}`,
        fields: {},
        inputs: {},
      }
      const result = extractor.extract(block)
      expect(result, `Strategy for ${type} should produce a node`).not.toBeNull()
    }
  })

  it('cpp_var_declare strategy extracts multi-variable declarations', () => {
    const extractor = new PatternExtractor()
    registerCppExtractStrategies(extractor)

    const block: BlockState = {
      type: 'cpp_var_declare',
      id: 'b1',
      fields: { TYPE: 'int', NAME_0: 'a', NAME_1: 'b' },
      inputs: {},
      extraState: { items: ['var', 'var'] },
    }
    const result = extractor.extract(block)!
    expect(result.componentId).toBe('cpp:var_declare')
    expect(result.properties.type).toBe('int')
    expect(result.children.declarators).toHaveLength(2)
    expect(result.children.declarators![0].properties.name).toBe('a')
    expect(result.children.declarators![1].properties.name).toBe('b')
  })

  it('cpp_if strategy extracts if with else-if chain', () => {
    const extractor = new PatternExtractor()
    registerCppExtractStrategies(extractor)
    // Also register var_ref strategy so condition extraction works
    // ⚠️ `renderMapping` 現在是**必填**——自動推導已退場。
    //
    // 在此之前這裡不寫也能過：`deriveRenderMapping` 會拿 `properties: ['name']`
    // 去比對欄位名 `NAME`，自動補上對應。而那個便利的代價是**參數宣告驅動了
    // 抽取行為**——改一顆元件的參數列就會改變它的積木怎麼被讀回來。
    //
    // 186 筆對應已固化成顯式宣告，推導已刪除，缺宣告由 `audit-explicit-mapping` 指名。
    extractor.loadBlockSpecs([{
      blockDef: { type: 'cpp_var_ref', args0: [{ type: 'field_input', name: 'NAME' }], output: 'any' },
      componentMapping: { componentId: 'cpp:var_ref', properties: ['name'], children: {} },
      renderMapping: { fields: { NAME: 'name' }, inputs: {}, statementInputs: {} },
    }])

    const block: BlockState = {
      type: 'cpp_if',
      id: 'b1',
      fields: {},
      inputs: {
        CONDITION: { block: { type: 'cpp_var_ref', id: 'c1', fields: { NAME: 'x' }, inputs: {} } },
        ELSEIF_CONDITION_0: { block: { type: 'cpp_var_ref', id: 'c2', fields: { NAME: 'y' }, inputs: {} } },
      },
      extraState: { elseifCount: 1 },
    }
    const result = extractor.extract(block)!
    expect(result.componentId).toBe('cpp:if')
    expect(result.children.condition![0].properties.name).toBe('x')
    expect(result.children.else_body).toHaveLength(1)
    expect(result.children.else_body![0].componentId).toBe('cpp:if')
    expect(result.children.else_body![0].properties.isElseIf).toBe('true')
  })

  it('cpp_input strategy extracts select-mode variables from extraState', () => {
    const extractor = new PatternExtractor()
    registerCppExtractStrategies(extractor)

    const block: BlockState = {
      type: 'cpp_input',
      id: 'b1',
      fields: {},
      inputs: {},
      extraState: { args: [{ mode: 'select', text: 'myVar' }] },
    }
    const result = extractor.extract(block)!
    expect(result.componentId).toBe('cpp:input')
    expect(result.properties.variable).toBe('myVar')
    expect(result.children.values![0].properties.name).toBe('myVar')
  })
})
