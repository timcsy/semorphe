/**
 * Migration Roundtrip Tests (Phase 5: US3)
 *
 * Verifies that blocks migrated from hand-written extractors/strategies
 * to JSON dynamicRules produce identical SemanticNode structures.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { createNode } from '../../src/core/semantic-tree'
// ⚠️ **第十三個組裝點**（今天第四處同一個形狀）。
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { componentComponents, componentBlocks } from '../../src/core/component/registry'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'

let extractor: PatternExtractor
let renderer: PatternRenderer

beforeAll(() => {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(
    [...universalComponents, ...coreComponents, ...allStdModules.flatMap(m => m.components), ...(componentComponents() as unknown as ComponentDefJSON[])],
    [...universalBlocks, ...coreBlocks, ...allStdModules.flatMap(m => m.blocks), ...(componentBlocks() as BlockProjectionJSON[])]
  )
  extractor = new PatternExtractor()
  renderer = new PatternRenderer()
  const allSpecs = reg.getAll()
  extractor.loadBlockSpecs(allSpecs)
  renderer.loadBlockSpecs(allSpecs)
})

describe('Migration roundtrip: func_call with dynamicRules', () => {
  it('extract → component identity preserved for func_call with args', () => {
    const blockState = {
      type: 'cpp_func_call',
      id: 'fc1',
      fields: { NAME: 'add' },
      inputs: {
        ARG_0: { block: { type: 'cpp_literal_number', id: 'a0', fields: { NUM: '1' }, inputs: {} } },
        ARG_1: { block: { type: 'cpp_var_ref', id: 'a1', fields: { NAME: 'x' }, inputs: {} } },
      },
      extraState: { argCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:func_call')
    expect(result!.properties.name).toBe('add')
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].componentId).toBe('cpp:literal_number')
    expect(result!.children.args[1].componentId).toBe('cpp:var_ref')
  })

  it('render → extract roundtrip for func_call', () => {
    const node = createNode('cpp:func_call', { name: 'sum' }, {
      args: [
        createNode('cpp:literal_number', { value: '42' }),
        createNode('cpp:var_ref', { name: 'y' }),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('cpp_func_call')
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.componentId).toBe('cpp:func_call')
    expect(reExtracted!.properties.name).toBe('sum')
    expect(reExtracted!.children.args).toHaveLength(2)
  })
})

describe('Migration roundtrip: func_def with dynamicRules', () => {
  it('extract → component identity preserved for func_def with params', () => {
    const blockState = {
      type: 'cpp_func_def',
      id: 'fd1',
      fields: { NAME: 'add', RETURN_TYPE: 'int', TYPE_0: 'int', PARAM_0: 'a', TYPE_1: 'double', PARAM_1: 'b' },
      inputs: {
        BODY: { block: { type: 'cpp_return', id: 'r1', fields: {}, inputs: {
          VALUE: { block: { type: 'cpp_var_ref', id: 'v1', fields: { NAME: 'a' }, inputs: {} } }
        } } },
      },
      extraState: { paramCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:func_def')
    expect(result!.properties.name).toBe('add')
    expect(result!.properties.return_type).toBe('int')
    expect(result!.children.params).toHaveLength(2)
    expect(result!.children.params[0].componentId).toBe('param_decl')
    expect(result!.children.params[0].properties.type).toBe('int')
    expect(result!.children.params[0].properties.name).toBe('a')
    expect(result!.children.params[1].properties.type).toBe('double')
    expect(result!.children.body).toHaveLength(1)
  })

  it('render → extract roundtrip for func_def', () => {
    const node = createNode('cpp:func_def', { name: 'greet', return_type: 'void' }, {
      params: [
        createNode('param_decl', { type: 'string', name: 'name' }),
      ],
      body: [createNode('cpp:break', {})],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('cpp_func_def')
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.componentId).toBe('cpp:func_def')
    expect(reExtracted!.children.params).toHaveLength(1)
    expect(reExtracted!.children.params[0].properties.name).toBe('name')
  })
})

describe('Migration roundtrip: print with dynamicRules', () => {
  it('extract → component identity preserved for print with values', () => {
    const blockState = {
      type: 'cpp_print',
      id: 'pr1',
      fields: {},
      inputs: {
        EXPR0: { block: { type: 'cpp_literal_string', id: 's1', fields: { TEXT: 'hello' }, inputs: {} } },
        EXPR1: { block: { type: 'cpp_endl', id: 'e1', fields: {}, inputs: {} } },
      },
      extraState: { itemCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:print')
    expect(result!.children.values).toHaveLength(2)
  })

  it('render → extract roundtrip for print', () => {
    const node = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:literal_string', { value: 'hi' }),
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:endl', {}),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.componentId).toBe('cpp:print')
    expect(reExtracted!.children.values).toHaveLength(3)
  })
})

describe('Migration roundtrip: input with dynamicRules', () => {
  /**
   * 🔄 **`cin >>` 的記憶方式換了**（2026-08-26）：`{ args: [{mode,text}] }`
   * → `{ itemCount }` ＋ `ARG_{i}` 接點。理由是它改用了與 `cout <<`
   * 同一個可變參數建構子——**兩個鏡像的運算，投影不該長得不一樣**。
   */
  it('extract → cin 的每一格都是接點，身分與名字都保住', () => {
    const varRef = (n: string, id: string) =>
      ({ type: 'cpp_var_ref', id, fields: { NAME: n }, inputs: {} })
    const blockState = {
      type: 'cpp_input',
      id: 'in1',
      fields: {},
      inputs: { ARG_0: { block: varRef('x', 'v0') }, ARG_1: { block: varRef('y', 'v1') } },
      extraState: { itemCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:input')
    expect(result!.children.values).toHaveLength(2)
    expect(result!.children.values[0].componentId).toBe('cpp:var_ref')
    expect(result!.children.values[0].properties.name).toBe('x')
    expect(result!.children.values[1].properties.name, '🔴 第二格掉了').toBe('y')
  })

  it('render → extract roundtrip for input', () => {
    const node = createNode('cpp:input', { variable: 'x' }, {
      values: [
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:var_ref', { name: 'y' }),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.componentId).toBe('cpp:input')
    expect(reExtracted!.children.values).toHaveLength(2)
  })
})

describe('Migration roundtrip: scanf/printf with dynamicRules', () => {
  it('extract → component identity for scanf with select/compose args', () => {
    const blockState = {
      type: 'cpp_input_formatted',
      id: 'sc1',
      fields: { FORMAT: '%d %f' },
      inputs: {
        ARG_1: { block: { type: 'cpp_arithmetic', id: 'a1', fields: { OP: '+' }, inputs: {
          A: { block: { type: 'cpp_literal_number', id: 'n1', fields: { NUM: '1' }, inputs: {} } },
          B: { block: { type: 'cpp_literal_number', id: 'n2', fields: { NUM: '2' }, inputs: {} } },
        } } },
      },
      extraState: {
        args: [
          { mode: 'select', text: 'x' },
          { mode: 'compose' },
        ],
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:input_formatted')
    expect(result!.properties.format).toBe('%d %f')
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].componentId).toBe('cpp:var_ref')
    expect(result!.children.args[1].componentId).toBe('cpp:arithmetic')
  })

  it('render → extract roundtrip for printf', () => {
    const node = createNode('cpp:print_formatted', { format: '%d\\n' }, {
      args: [createNode('cpp:var_ref', { name: 'x' })],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.componentId).toBe('cpp:print_formatted')
    expect(reExtracted!.children.args).toHaveLength(1)
  })
})

describe('Migration roundtrip: if with elseif chain', () => {
  // NOTE: if-elseif uses nested-if semantic model (isElseIf property),
  // which requires the hand-written cpp:renderIf strategy to flatten.
  // Keeping strategy-based rendering for now; dynamicRules cannot handle
  // the nested→flat transformation.
  it('extract → static mapping works for simple if', () => {
    const blockState = {
      type: 'cpp_if',
      id: 'if1',
      fields: {},
      inputs: {
        CONDITION: { block: { type: 'cpp_var_ref', id: 'c0', fields: { NAME: 'a' }, inputs: {} } },
        THEN: { block: { type: 'cpp_break', id: 't0', fields: {}, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:if')
    expect(result!.children.condition).toHaveLength(1)
    expect(result!.children.then_body).toHaveLength(1)
  })
})

describe('Migration roundtrip: forward_decl with dynamicRules', () => {
  it('extract → component identity for forward_decl with params', () => {
    const blockState = {
      type: 'cpp_forward_decl',
      id: 'fwd1',
      fields: { RETURN_TYPE: 'int', NAME: 'add', TYPE_0: 'int', TYPE_1: 'double' },
      inputs: {},
      extraState: { paramCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:forward_decl')
    expect(result!.properties.return_type).toBe('int')
    expect(result!.properties.name).toBe('add')
    expect(result!.children.params).toHaveLength(2)
    expect(result!.children.params[0].properties.type).toBe('int')
    expect(result!.children.params[1].properties.type).toBe('double')
  })
})

describe('Migration roundtrip: doc_comment', () => {
  // NOTE: doc_comment uses flat properties (param_0_name, param_0_desc) in its semantic model,
  // not children. Keeping strategy-based rendering for now.
  it('extract → component identity for doc_comment brief field', () => {
    const blockState = {
      type: 'cpp_doc_comment',
      id: 'doc1',
      fields: { BRIEF: 'Add two numbers' },
      inputs: {},
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.componentId).toBe('cpp:doc_comment')
    expect(result!.properties.brief).toBe('Add two numbers')
  })
})
