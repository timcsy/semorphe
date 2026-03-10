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
      name: 'main', return_type: 'int',
    }, {
      params: [
        createNode('param_decl', { type: 'int', name: 'a' }),
        createNode('param_decl', { type: 'int', name: 'b' }),
      ],
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

  it('should render cpp_printf with format and args', () => {
    const printf = createNode('cpp_printf', { format: '%.2f\\n' }, {
      args: [createNode('var_ref', { name: 'x' })],
    })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_printf')
    expect(block.fields.FORMAT).toBe('%.2f\\n')
    expect(block.extraState).toBeDefined()
    expect(block.extraState.args).toHaveLength(1)
    expect(block.extraState.args[0].mode).toBe('select')
    expect(block.extraState.args[0].text).toBe('x')
  })

  it('should render cpp_printf with no args', () => {
    const printf = createNode('cpp_printf', { format: 'hello\\n' }, { args: [] })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_printf')
    expect(block.fields.FORMAT).toBe('hello\\n')
    expect(block.extraState).toBeDefined()
    expect(block.extraState.args).toHaveLength(0)
  })

  it('should render cpp_scanf with format and args', () => {
    const scanf = createNode('cpp_scanf', { format: '%d %d' }, {
      args: [
        createNode('var_ref', { name: 'a' }),
        createNode('var_ref', { name: 'b' }),
      ],
    })
    const state = renderToBlocklyState(makeProgram(scanf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_scanf')
    expect(block.fields.FORMAT).toBe('%d %d')
    expect(block.extraState).toBeDefined()
    expect(block.extraState.args).toHaveLength(2)
    expect(block.extraState.args[0]).toEqual({ mode: 'select', text: 'a' })
    expect(block.extraState.args[1]).toEqual({ mode: 'select', text: 'b' })
  })

  it('should render cpp_printf with non-var_ref args in compose mode', () => {
    const printf = createNode('cpp_printf', { format: 'sum=%d\\n' }, {
      args: [createNode('arithmetic', { operator: '+' }, {
        left: [createNode('var_ref', { name: 'x' })],
        right: [createNode('var_ref', { name: 'y' })],
      })],
    })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_printf')
    expect(block.fields.FORMAT).toBe('sum=%d\\n')
    expect(block.extraState.args).toHaveLength(1)
    expect(block.extraState.args[0].mode).toBe('compose')
    // The expression block should be in inputs.ARG_0
    expect(block.inputs.ARG_0).toBeDefined()
    expect(block.inputs.ARG_0.block.type).toBe('u_arithmetic')
  })

  it('should render raw_code as c_raw_code', () => {
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: 'auto x = 5;' }
    const state = renderToBlocklyState(makeProgram(raw))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_raw_code')
    expect(block.fields.CODE).toBe('auto x = 5;')
  })

  it('should render cpp_increment in expression context as c_increment_expr', () => {
    const forLoop = createNode('cpp_for_loop', {}, {
      init: [createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' })],
      })],
      cond: [createNode('compare', { operator: '<' }, {
        left: [createNode('var_ref', { name: 'i' })],
        right: [createNode('number_literal', { value: '10' })],
      })],
      update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' })],
      body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('c_for_loop')
    // UPDATE input should use expression block, not raw expression
    const updateBlock = block.inputs.UPDATE?.block
    expect(updateBlock).toBeDefined()
    expect(updateBlock.type).toBe('c_increment_expr')
    expect(updateBlock.fields.NAME).toBe('i')
    expect(updateBlock.fields.OP).toBe('++')
  })

  it('should render cpp_compound_assign in expression context as c_compound_assign_expr', () => {
    const forLoop = createNode('cpp_for_loop', {}, {
      init: [createNode('var_ref', { name: 'i' })],
      cond: [createNode('var_ref', { name: 'x' })],
      update: [createNode('cpp_compound_assign', { name: 'j', operator: '+=' }, {
        value: [createNode('var_ref', { name: 'i' })],
      })],
      body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    const updateBlock = block.inputs.UPDATE?.block
    expect(updateBlock).toBeDefined()
    expect(updateBlock.type).toBe('c_compound_assign_expr')
    expect(updateBlock.fields.NAME).toBe('j')
    expect(updateBlock.fields.OP).toBe('+=')
  })

  it('should render var_declare in expression context as c_var_declare_expr', () => {
    const forLoop = createNode('cpp_for_loop', {}, {
      init: [createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '2' })],
      })],
      cond: [createNode('var_ref', { name: 'x' })],
      update: [createNode('var_ref', { name: 'i' })],
      body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    const initBlock = block.inputs.INIT?.block
    expect(initBlock).toBeDefined()
    expect(initBlock.type).toBe('c_var_declare_expr')
    expect(initBlock.fields.TYPE).toBe('int')
    expect(initBlock.fields.NAME_0).toBe('i')
    expect(initBlock.inputs.INIT_0).toBeDefined()
  })
})
