/**
 * Dynamic Rules Tests (Phase 4: US2)
 *
 * Tests for PatternExtractor and PatternRenderer's dynamicRules support.
 * Covers: repeat input, repeat field group, multi-mode slot, if-elseif chain,
 * and repeat expression patterns.
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
import type { ConceptDefJSON, BlockProjectionJSON, BlockSpec, RenderMapping } from '../../src/core/types'

let extractor: PatternExtractor
let renderer: PatternRenderer
let registry: BlockSpecRegistry

beforeAll(() => {
  registry = new BlockSpecRegistry()
  registry.loadFromSplit(
    [...universalConcepts as unknown as ConceptDefJSON[], ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)],
    [...universalBlocks as unknown as BlockProjectionJSON[], ...coreBlocks, ...allStdModules.flatMap(m => m.blocks)]
  )
  extractor = new PatternExtractor()
  renderer = new PatternRenderer()

  // Inject test-only block specs with dynamicRules for testing
  const testSpecs = createTestBlockSpecs()
  const allSpecs = [...registry.getAll(), ...testSpecs]
  extractor.loadBlockSpecs(allSpecs)
  renderer.loadBlockSpecs(allSpecs)
})

/** Create test-only BlockSpecs with dynamicRules for all five patterns */
function createTestBlockSpecs(): BlockSpec[] {
  return [
    // Pattern 1: Repeat input (func_call ARG_0..N)
    {
      id: 'test_func_call',
      language: 'test',
      category: 'test',
      version: '1.0.0',
      concept: {
        conceptId: 'test_func_call',
        properties: ['name'],
        children: { args: 'expression' },
        role: 'expression',
      },
      blockDef: { type: 'test_func_call', output: 'Expression' },
      codeTemplate: { pattern: '', imports: [], order: 0 },
      astPattern: { nodeType: '', constraints: [] },
      renderMapping: {
        fields: { NAME: 'name' },
        inputs: {},
        statementInputs: {},
        dynamicRules: [
          {
            countSource: 'argCount',
            childSlot: 'args',
            inputPattern: 'ARG_{i}',
          },
        ],
      },
    },
    // Pattern 2: Repeat field group (func_def TYPE_0/PARAM_0..N)
    {
      id: 'test_func_def',
      language: 'test',
      category: 'test',
      version: '1.0.0',
      concept: {
        conceptId: 'test_func_def',
        properties: ['name', 'return_type'],
        children: { params: 'expression', body: 'statements' },
        role: 'statement',
      },
      blockDef: { type: 'test_func_def', previousStatement: null, nextStatement: null },
      codeTemplate: { pattern: '', imports: [], order: 0 },
      astPattern: { nodeType: '', constraints: [] },
      renderMapping: {
        fields: { NAME: 'name', RETURN_TYPE: 'return_type' },
        inputs: {},
        statementInputs: { BODY: 'body' },
        dynamicRules: [
          {
            countSource: 'paramCount',
            childSlot: 'params',
            childConcept: 'param_decl',
            childFields: { 'TYPE_{i}': 'type', 'PARAM_{i}': 'name' },
          },
        ],
      },
    },
    // Pattern 3: Multi-mode slot (scanf select/compose)
    {
      id: 'test_scanf',
      language: 'test',
      category: 'test',
      version: '1.0.0',
      concept: {
        conceptId: 'test_scanf',
        properties: ['format'],
        children: { args: 'expression' },
        role: 'statement',
      },
      blockDef: { type: 'test_scanf', previousStatement: null, nextStatement: null },
      codeTemplate: { pattern: '', imports: [], order: 0 },
      astPattern: { nodeType: '', constraints: [] },
      renderMapping: {
        fields: { FORMAT: 'format' },
        inputs: {},
        statementInputs: {},
        dynamicRules: [
          {
            countSource: 'args.length',
            childSlot: 'args',
            modeSource: 'args[{i}].mode',
            modes: {
              select: { field: 'args[{i}].text', wrap: 'var_ref' },
              compose: { input: 'ARG_{i}' },
            },
          },
        ],
      },
    },
    // Pattern 4: If-elseif chain
    {
      id: 'test_if',
      language: 'test',
      category: 'test',
      version: '1.0.0',
      concept: {
        conceptId: 'test_if',
        properties: [],
        children: { condition: 'expression', then_body: 'statements', else_body: 'statements' },
        role: 'statement',
      },
      blockDef: { type: 'test_if', previousStatement: null, nextStatement: null },
      codeTemplate: { pattern: '', imports: [], order: 0 },
      astPattern: { nodeType: '', constraints: [] },
      renderMapping: {
        fields: {},
        inputs: { CONDITION: 'condition' },
        statementInputs: { THEN: 'then_body', ELSE: 'else_body' },
        dynamicRules: [
          {
            countSource: 'elseifCount',
            childSlot: 'elseif_conditions',
            inputPattern: 'ELSEIF_CONDITION_{i}',
          },
          {
            countSource: 'elseifCount',
            childSlot: 'elseif_bodies',
            inputPattern: 'ELSEIF_THEN_{i}',
            isStatementInput: true,
          },
        ],
      } as RenderMapping,
    },
    // Pattern 5: Repeat expression (print EXPR0..N)
    {
      id: 'test_print',
      language: 'test',
      category: 'test',
      version: '1.0.0',
      concept: {
        conceptId: 'test_print',
        properties: [],
        children: { values: 'expression' },
        role: 'statement',
      },
      blockDef: { type: 'test_print', previousStatement: null, nextStatement: null },
      codeTemplate: { pattern: '', imports: [], order: 0 },
      astPattern: { nodeType: '', constraints: [] },
      renderMapping: {
        fields: {},
        inputs: {},
        statementInputs: {},
        dynamicRules: [
          {
            countSource: 'itemCount',
            childSlot: 'values',
            inputPattern: 'EXPR{i}',
          },
        ],
      },
    },
  ]
}

describe('T011: PatternExtractor dynamicRules — repeat input (func_call)', () => {
  it('extracts ARG_0..2 with argCount=3 from extraState', () => {
    const blockState = {
      type: 'test_func_call',
      id: 'fc1',
      fields: { NAME: 'add' },
      inputs: {
        ARG_0: { block: { type: 'u_number', id: 'a0', fields: { NUM: '1' }, inputs: {} } },
        ARG_1: { block: { type: 'u_number', id: 'a1', fields: { NUM: '2' }, inputs: {} } },
        ARG_2: { block: { type: 'u_var_ref', id: 'a2', fields: { NAME: 'x' }, inputs: {} } },
      },
      extraState: { argCount: 3 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('test_func_call')
    expect(result!.properties.name).toBe('add')
    expect(result!.children.args).toHaveLength(3)
    expect(result!.children.args[0].concept).toBe('number_literal')
    expect(result!.children.args[0].properties.value).toBe('1')
    expect(result!.children.args[2].concept).toBe('var_ref')
    expect(result!.children.args[2].properties.name).toBe('x')
  })

  it('handles zero-arg case (argCount=0 or missing extraState)', () => {
    const blockState = {
      type: 'test_func_call',
      id: 'fc2',
      fields: { NAME: 'doNothing' },
      inputs: {},
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('test_func_call')
    expect(result!.children.args ?? []).toHaveLength(0)
  })
})

describe('T012: PatternExtractor dynamicRules — multi-mode slot (scanf)', () => {
  it('extracts select mode args as var_ref nodes', () => {
    const blockState = {
      type: 'test_scanf',
      id: 'sc1',
      fields: { FORMAT: '%d %d' },
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
    expect(result!.concept).toBe('test_scanf')
    expect(result!.properties.format).toBe('%d %d')
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].concept).toBe('var_ref')
    expect(result!.children.args[0].properties.name).toBe('x')
    expect(result!.children.args[1].concept).toBe('var_ref')
    expect(result!.children.args[1].properties.name).toBe('y')
  })

  it('extracts compose mode args from block inputs', () => {
    const blockState = {
      type: 'test_scanf',
      id: 'sc2',
      fields: { FORMAT: '%d' },
      inputs: {
        ARG_1: { block: { type: 'u_arithmetic', id: 'ex1', fields: { OP: '+' }, inputs: {
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
    expect(result!.children.args).toHaveLength(2)
    expect(result!.children.args[0].concept).toBe('var_ref')
    expect(result!.children.args[0].properties.name).toBe('x')
    expect(result!.children.args[1].concept).toBe('arithmetic')
  })
})

describe('T013: PatternExtractor dynamicRules — repeat field group (func_def)', () => {
  it('extracts TYPE_0/PARAM_0..1 as param_decl children', () => {
    const blockState = {
      type: 'test_func_def',
      id: 'fd1',
      fields: { NAME: 'add', RETURN_TYPE: 'int', TYPE_0: 'int', PARAM_0: 'a', TYPE_1: 'int', PARAM_1: 'b' },
      inputs: {},
      extraState: { paramCount: 2 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('test_func_def')
    expect(result!.properties.name).toBe('add')
    expect(result!.properties.return_type).toBe('int')
    expect(result!.children.params).toHaveLength(2)
    expect(result!.children.params[0].concept).toBe('param_decl')
    expect(result!.children.params[0].properties.type).toBe('int')
    expect(result!.children.params[0].properties.name).toBe('a')
    expect(result!.children.params[1].properties.name).toBe('b')
  })

  it('handles zero params (no extraState)', () => {
    const blockState = {
      type: 'test_func_def',
      id: 'fd2',
      fields: { NAME: 'main', RETURN_TYPE: 'int' },
      inputs: {},
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.children.params ?? []).toHaveLength(0)
  })
})

describe('T014: PatternExtractor dynamicRules — if-elseif chain', () => {
  it('extracts ELSEIF_CONDITION_0..1 and ELSEIF_THEN_0..1 as children', () => {
    const blockState = {
      type: 'test_if',
      id: 'if1',
      fields: {},
      inputs: {
        CONDITION: { block: { type: 'u_var_ref', id: 'c0', fields: { NAME: 'cond0' }, inputs: {} } },
        THEN: { block: { type: 'u_break', id: 't0', fields: {}, inputs: {} } },
        ELSEIF_CONDITION_0: { block: { type: 'u_var_ref', id: 'c1', fields: { NAME: 'cond1' }, inputs: {} } },
        ELSEIF_THEN_0: { block: { type: 'u_continue', id: 't1', fields: {}, inputs: {} } },
        ELSEIF_CONDITION_1: { block: { type: 'u_var_ref', id: 'c2', fields: { NAME: 'cond2' }, inputs: {} } },
        ELSEIF_THEN_1: { block: { type: 'u_break', id: 't2', fields: {}, inputs: {} } },
        ELSE: { block: { type: 'u_continue', id: 'e1', fields: {}, inputs: {} } },
      },
      extraState: { elseifCount: 2, hasElse: true },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('test_if')
    // Static mappings
    expect(result!.children.condition).toHaveLength(1)
    expect(result!.children.then_body).toHaveLength(1)
    expect(result!.children.else_body).toHaveLength(1)
    // Dynamic elseif conditions
    expect(result!.children.elseif_conditions).toHaveLength(2)
    expect(result!.children.elseif_conditions[0].concept).toBe('var_ref')
    expect(result!.children.elseif_conditions[0].properties.name).toBe('cond1')
    // Dynamic elseif bodies (statement chains)
    expect(result!.children.elseif_bodies).toHaveLength(2)
  })

  it('handles no elseif (no extraState)', () => {
    const blockState = {
      type: 'test_if',
      id: 'if2',
      fields: {},
      inputs: {
        CONDITION: { block: { type: 'u_var_ref', id: 'c0', fields: { NAME: 'x' }, inputs: {} } },
        THEN: { block: { type: 'u_break', id: 't0', fields: {}, inputs: {} } },
      },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.children.elseif_conditions ?? []).toHaveLength(0)
  })
})

describe('T011 (print): PatternExtractor dynamicRules — repeat expression (print)', () => {
  it('extracts EXPR0..2 with itemCount=3', () => {
    const blockState = {
      type: 'test_print',
      id: 'pr1',
      fields: {},
      inputs: {
        EXPR0: { block: { type: 'u_string', id: 's1', fields: { TEXT: 'hello' }, inputs: {} } },
        EXPR1: { block: { type: 'u_var_ref', id: 'v1', fields: { NAME: 'x' }, inputs: {} } },
        EXPR2: { block: { type: 'u_endl', id: 'e1', fields: {}, inputs: {} } },
      },
      extraState: { itemCount: 3 },
    }
    const result = extractor.extract(blockState as never)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('test_print')
    expect(result!.children.values).toHaveLength(3)
    expect(result!.children.values[0].concept).toBe('string_literal')
    expect(result!.children.values[1].concept).toBe('var_ref')
    expect(result!.children.values[2].concept).toBe('endl')
  })
})

// ─── Renderer Tests ───

describe('PatternRenderer dynamicRules — repeat input (func_call)', () => {
  it('renders func_call with 3 args into dynamic inputs + extraState', () => {
    const node = createNode('test_func_call', { name: 'add' }, {
      args: [
        createNode('number_literal', { value: '1' }),
        createNode('number_literal', { value: '2' }),
        createNode('var_ref', { name: 'x' }),
      ],
    })
    renderer.resetIds()
    const result = renderer.render(node)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('test_func_call')
    expect(result!.fields.NAME).toBe('add')
    expect(result!.extraState).toBeDefined()
    expect(result!.extraState!.argCount).toBe(3)
    expect(result!.inputs.ARG_0).toBeDefined()
    expect(result!.inputs.ARG_1).toBeDefined()
    expect(result!.inputs.ARG_2).toBeDefined()
  })
})

describe('PatternRenderer dynamicRules — multi-mode slot (scanf)', () => {
  it('renders mixed select/compose args into extraState.args + inputs', () => {
    const node = createNode('test_scanf', { format: '%d %d' }, {
      args: [
        createNode('var_ref', { name: 'x' }),
        createNode('arithmetic', { operator: '+' }, {
          left: [createNode('number_literal', { value: '1' })],
          right: [createNode('number_literal', { value: '2' })],
        }),
      ],
    })
    renderer.resetIds()
    const result = renderer.render(node)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('test_scanf')
    expect(result!.fields.FORMAT).toBe('%d %d')
    expect(result!.extraState).toBeDefined()
    const args = result!.extraState!.args as Array<{ mode: string; text?: string }>
    expect(args).toHaveLength(2)
    expect(args[0].mode).toBe('select')
    expect(args[0].text).toBe('x')
    expect(args[1].mode).toBe('compose')
    // compose mode: expression rendered as input block
    expect(result!.inputs.ARG_1).toBeDefined()
  })
})

describe('PatternRenderer dynamicRules — repeat field group (func_def)', () => {
  it('renders func_def with 2 params as dynamic fields + extraState', () => {
    const node = createNode('test_func_def', { name: 'add', return_type: 'int' }, {
      params: [
        createNode('param_decl', { type: 'int', name: 'a' }),
        createNode('param_decl', { type: 'int', name: 'b' }),
      ],
      body: [],
    })
    renderer.resetIds()
    const result = renderer.render(node)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('test_func_def')
    expect(result!.fields.NAME).toBe('add')
    expect(result!.fields.RETURN_TYPE).toBe('int')
    expect(result!.extraState).toBeDefined()
    expect(result!.extraState!.paramCount).toBe(2)
    expect(result!.fields.TYPE_0).toBe('int')
    expect(result!.fields.PARAM_0).toBe('a')
    expect(result!.fields.TYPE_1).toBe('int')
    expect(result!.fields.PARAM_1).toBe('b')
  })
})

describe('PatternRenderer dynamicRules — repeat expression (print)', () => {
  it('renders print with 3 values as dynamic inputs + extraState', () => {
    const node = createNode('test_print', {}, {
      values: [
        createNode('string_literal', { value: 'hello' }),
        createNode('var_ref', { name: 'x' }),
        createNode('endl', {}),
      ],
    })
    renderer.resetIds()
    const result = renderer.render(node)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('test_print')
    expect(result!.extraState).toBeDefined()
    expect(result!.extraState!.itemCount).toBe(3)
    expect(result!.inputs.EXPR0).toBeDefined()
    expect(result!.inputs.EXPR1).toBeDefined()
    expect(result!.inputs.EXPR2).toBeDefined()
  })
})

// ─── Roundtrip Tests ───

describe('dynamicRules roundtrip: extract → render → extract', () => {
  it('func_call roundtrips correctly', () => {
    const blockState = {
      type: 'test_func_call',
      id: 'rt1',
      fields: { NAME: 'f' },
      inputs: {
        ARG_0: { block: { type: 'u_number', id: 'n1', fields: { NUM: '42' }, inputs: {} } },
      },
      extraState: { argCount: 1 },
    }
    const node = extractor.extract(blockState as never)
    expect(node).not.toBeNull()
    renderer.resetIds()
    const rendered = renderer.render(node!)
    expect(rendered).not.toBeNull()
    const reExtracted = extractor.extract(rendered as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('test_func_call')
    expect(reExtracted!.properties.name).toBe('f')
    expect(reExtracted!.children.args).toHaveLength(1)
    expect(reExtracted!.children.args[0].concept).toBe('number_literal')
  })

  it('print roundtrips correctly', () => {
    const blockState = {
      type: 'test_print',
      id: 'rt2',
      fields: {},
      inputs: {
        EXPR0: { block: { type: 'u_string', id: 's1', fields: { TEXT: 'hi' }, inputs: {} } },
        EXPR1: { block: { type: 'u_endl', id: 'e1', fields: {}, inputs: {} } },
      },
      extraState: { itemCount: 2 },
    }
    const node = extractor.extract(blockState as never)
    expect(node).not.toBeNull()
    renderer.resetIds()
    const rendered = renderer.render(node!)
    expect(rendered).not.toBeNull()
    const reExtracted = extractor.extract(rendered as never)
    expect(reExtracted).not.toBeNull()
    expect(reExtracted!.concept).toBe('test_print')
    expect(reExtracted!.children.values).toHaveLength(2)
  })
})
