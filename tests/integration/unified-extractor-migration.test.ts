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
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'

let extractor: PatternExtractor
let renderer: PatternRenderer

beforeAll(() => {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(
    [...universalConcepts as unknown as ConceptDefJSON[], ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)],
    [...universalBlocks as unknown as BlockProjectionJSON[], ...coreBlocks, ...allStdModules.flatMap(m => m.blocks)]
  )
  extractor = new PatternExtractor()
  renderer = new PatternRenderer()
  const allSpecs = reg.getAll()
  extractor.loadBlockSpecs(allSpecs)
  renderer.loadBlockSpecs(allSpecs)
})

describe('Migration roundtrip: func_call with dynamicRules', () => {
  it('extract → concept identity preserved for func_call with args', () => {
    const blockState = {
      type: 'u_func_call',
      id: 'fc1',
      fields: { NAME: 'add' },
      inputs: {
        ARG_0: { block: { type: 'u_number', id: 'a0', fields: { NUM: '1' }, inputs: {} } },
        ARG_1: { block: { type: 'u_var_ref', id: 'a1', fields: { NAME: 'x' }, inputs: {} } },
      },
      extraState: { argCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('func_call')
    expect(result!.properties.name).toBe('add')
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].concept).toBe('number_literal')
    expect(result!.children.args[1].concept).toBe('var_ref')
  })

  it('render → extract roundtrip for func_call', () => {
    const node = createNode('func_call', { name: 'sum' }, {
      args: [
        createNode('number_literal', { value: '42' }),
        createNode('var_ref', { name: 'y' }),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('u_func_call')
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('func_call')
    expect(reExtracted!.properties.name).toBe('sum')
    expect(reExtracted!.children.args).toHaveLength(2)
  })
})

describe('Migration roundtrip: func_def with dynamicRules', () => {
  it('extract → concept identity preserved for func_def with params', () => {
    const blockState = {
      type: 'u_func_def',
      id: 'fd1',
      fields: { NAME: 'add', RETURN_TYPE: 'int', TYPE_0: 'int', PARAM_0: 'a', TYPE_1: 'double', PARAM_1: 'b' },
      inputs: {
        BODY: { block: { type: 'u_return', id: 'r1', fields: {}, inputs: {
          VALUE: { block: { type: 'u_var_ref', id: 'v1', fields: { NAME: 'a' }, inputs: {} } }
        } } },
      },
      extraState: { paramCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('func_def')
    expect(result!.properties.name).toBe('add')
    expect(result!.properties.return_type).toBe('int')
    expect(result!.children.params).toHaveLength(2)
    expect(result!.children.params[0].concept).toBe('param_decl')
    expect(result!.children.params[0].properties.type).toBe('int')
    expect(result!.children.params[0].properties.name).toBe('a')
    expect(result!.children.params[1].properties.type).toBe('double')
    expect(result!.children.body).toHaveLength(1)
  })

  it('render → extract roundtrip for func_def', () => {
    const node = createNode('func_def', { name: 'greet', return_type: 'void' }, {
      params: [
        createNode('param_decl', { type: 'string', name: 'name' }),
      ],
      body: [createNode('break', {})],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('u_func_def')
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('func_def')
    expect(reExtracted!.children.params).toHaveLength(1)
    expect(reExtracted!.children.params[0].properties.name).toBe('name')
  })
})

describe('Migration roundtrip: print with dynamicRules', () => {
  it('extract → concept identity preserved for print with values', () => {
    const blockState = {
      type: 'u_print',
      id: 'pr1',
      fields: {},
      inputs: {
        EXPR0: { block: { type: 'u_string', id: 's1', fields: { TEXT: 'hello' }, inputs: {} } },
        EXPR1: { block: { type: 'u_endl', id: 'e1', fields: {}, inputs: {} } },
      },
      extraState: { itemCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('print')
    expect(result!.children.values).toHaveLength(2)
  })

  it('render → extract roundtrip for print', () => {
    const node = createNode('print', {}, {
      values: [
        createNode('string_literal', { value: 'hi' }),
        createNode('var_ref', { name: 'x' }),
        createNode('endl', {}),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('print')
    expect(reExtracted!.children.values).toHaveLength(3)
  })
})

describe('Migration roundtrip: input with dynamicRules', () => {
  it('extract → concept identity preserved for cin with select vars', () => {
    const blockState = {
      type: 'u_input',
      id: 'in1',
      fields: {},
      inputs: {},
      extraState: {
        args: [
          { mode: 'select', text: 'x' },
          { mode: 'select', text: 'y' },
        ],
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('input')
    expect(result!.children.values).toHaveLength(2)
    expect(result!.children.values[0].concept).toBe('var_ref')
    expect(result!.children.values[0].properties.name).toBe('x')
  })

  it('render → extract roundtrip for input', () => {
    const node = createNode('input', { variable: 'x' }, {
      values: [
        createNode('var_ref', { name: 'x' }),
        createNode('var_ref', { name: 'y' }),
      ],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('input')
    expect(reExtracted!.children.values).toHaveLength(2)
  })
})

describe('Migration roundtrip: scanf/printf with dynamicRules', () => {
  it('extract → concept identity for scanf with select/compose args', () => {
    const blockState = {
      type: 'c_scanf',
      id: 'sc1',
      fields: { FORMAT: '%d %f' },
      inputs: {
        ARG_1: { block: { type: 'u_arithmetic', id: 'a1', fields: { OP: '+' }, inputs: {
          A: { block: { type: 'u_number', id: 'n1', fields: { NUM: '1' }, inputs: {} } },
          B: { block: { type: 'u_number', id: 'n2', fields: { NUM: '2' }, inputs: {} } },
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
    expect(result!.concept).toBe('cpp_scanf')
    expect(result!.properties.format).toBe('%d %f')
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].concept).toBe('var_ref')
    expect(result!.children.args[1].concept).toBe('arithmetic')
  })

  it('render → extract roundtrip for printf', () => {
    const node = createNode('cpp_printf', { format: '%d\\n' }, {
      args: [createNode('var_ref', { name: 'x' })],
    })
    renderer.resetIds()
    const block = renderer.render(node)
    expect(block).not.toBeNull()
    const reExtracted = extractor.extract(block as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('cpp_printf')
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
      type: 'u_if',
      id: 'if1',
      fields: {},
      inputs: {
        CONDITION: { block: { type: 'u_var_ref', id: 'c0', fields: { NAME: 'a' }, inputs: {} } },
        THEN: { block: { type: 'u_break', id: 't0', fields: {}, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('if')
    expect(result!.children.condition).toHaveLength(1)
    expect(result!.children.then_body).toHaveLength(1)
  })
})

describe('Migration roundtrip: forward_decl with dynamicRules', () => {
  it('extract → concept identity for forward_decl with params', () => {
    const blockState = {
      type: 'c_forward_decl',
      id: 'fwd1',
      fields: { RETURN_TYPE: 'int', NAME: 'add', TYPE_0: 'int', TYPE_1: 'double' },
      inputs: {},
      extraState: { paramCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('forward_decl')
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
  it('extract → concept identity for doc_comment brief field', () => {
    const blockState = {
      type: 'c_comment_doc',
      id: 'doc1',
      fields: { BRIEF: 'Add two numbers' },
      inputs: {},
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('doc_comment')
    expect(result!.properties.brief).toBe('Add two numbers')
  })
})
