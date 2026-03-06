import { describe, it, expect, beforeAll } from 'vitest'
import { renderToBlocklyState } from '../../../src/core/projection/block-renderer'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'
import { setupTestRenderer } from '../../helpers/setup-renderer'

function makeProgram(...body: SemanticNode[]): SemanticNode {
  return { id: 'root', concept: 'program', properties: {}, children: { body } }
}

describe('block-renderer', () => {
  beforeAll(() => {
    setupTestRenderer()
  })
  it('should render empty program', () => {
    const tree = makeProgram()
    const state = renderToBlocklyState(tree)
    expect(state.blocks.blocks).toHaveLength(0)
  })

  it('should render var_declare', () => {
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, {
      initializer: [createNode('number_literal', { value: '5' })],
    })
    const state = renderToBlocklyState(makeProgram(decl))
    expect(state.blocks.blocks).toHaveLength(1)
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('u_var_declare')
    expect(block.fields.TYPE).toBe('int')
    expect(block.fields.NAME_0).toBe('x')
    expect(block.inputs.INIT_0).toBeDefined()
    expect(block.inputs.INIT_0.block.type).toBe('u_number')
  })

  it('should render var_assign', () => {
    const assign = createNode('var_assign', { name: 'x' }, {
      value: [createNode('var_ref', { name: 'y' })],
    })
    const state = renderToBlocklyState(makeProgram(assign))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('u_var_assign')
    expect(block.fields.NAME).toBe('x')
    expect(block.inputs.VALUE.block.type).toBe('u_var_ref')
  })

  it('should render arithmetic expression', () => {
    const expr = createNode('arithmetic', { operator: '+' }, {
      left: [createNode('var_ref', { name: 'a' })],
      right: [createNode('number_literal', { value: '1' })],
    })
    const assign = createNode('var_assign', { name: 'x' }, { value: [expr] })
    const state = renderToBlocklyState(makeProgram(assign))
    const block = state.blocks.blocks[0]
    expect(block.inputs.VALUE.block.type).toBe('u_arithmetic')
    expect(block.inputs.VALUE.block.fields.OP).toBe('+')
  })

  it('should render if with else', () => {
    const ifStmt = createNode('if', {}, {
      condition: [createNode('var_ref', { name: 'x' })],
      then_body: [createNode('break', {})],
      else_body: [createNode('continue', {})],
    })
    const state = renderToBlocklyState(makeProgram(ifStmt))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('u_if')
    expect(block.inputs.CONDITION).toBeDefined()
    expect(block.inputs.THEN).toBeDefined()
    expect(block.inputs.ELSE).toBeDefined()
    expect(block.extraState).toEqual({ hasElse: true })
  })

  it('should render if without else as u_if', () => {
    const ifStmt = createNode('if', {}, {
      condition: [createNode('var_ref', { name: 'x' })],
      then_body: [createNode('break', {})],
      else_body: [],
    })
    const state = renderToBlocklyState(makeProgram(ifStmt))
    expect(state.blocks.blocks[0].type).toBe('u_if')
  })

  it('should chain statement blocks via next', () => {
    const s1 = createNode('break', {})
    const s2 = createNode('continue', {})
    const state = renderToBlocklyState(makeProgram(s1, s2))
    expect(state.blocks.blocks).toHaveLength(1)
    const first = state.blocks.blocks[0]
    expect(first.type).toBe('u_break')
    expect(first.next.block.type).toBe('u_continue')
  })

  it('should render func_def', () => {
    const func = createNode('func_def', {
      name: 'main', return_type: 'int', params: ['int a', 'int b'],
    }, {
      body: [createNode('return', {}, { value: [createNode('number_literal', { value: '0' })] })],
    })
    const state = renderToBlocklyState(makeProgram(func))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('u_func_def')
    expect(block.fields.NAME).toBe('main')
    expect(block.fields.RETURN_TYPE).toBe('int')
  })

  it('should render print with values', () => {
    const print = createNode('print', {}, {
      values: [
        createNode('var_ref', { name: 'x' }),
        createNode('endl', {}),
      ],
    })
    const state = renderToBlocklyState(makeProgram(print))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('u_print')
    expect(block.inputs.EXPR0).toBeDefined()
    expect(block.inputs.EXPR1).toBeDefined()
  })

  it('should render raw_code as c_raw_code', () => {
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: 'auto x = 5;' }
    const state = renderToBlocklyState(makeProgram(raw))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_raw_code')
    expect(block.fields.CODE).toBe('auto x = 5;')
  })
})
