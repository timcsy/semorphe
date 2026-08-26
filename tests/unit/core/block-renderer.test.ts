import { describe, it, expect, beforeAll } from 'vitest'
import { renderToBlocklyState } from '../../../src/core/projection/block-renderer'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'
import { setupTestRenderer } from '../../helpers/setup-renderer'

// 🔴 **spec 154：降級積木的型別由語言套件宣告**，核心不再寫死 `cpp_raw_code`。
//    ⚠️ 這一支測的是**真行為**（降級時渲染成哪一顆），所以它**宣告之後繼續測**
//    ——不是「被刪的功能」。
import { declareDegradationBlocks, setDegradationLanguage } from '../../../src/core/degradation-blocks'
declareDegradationBlocks('cpp', { statement: 'cpp_raw_code', expression: 'cpp_raw_expression' })
setDegradationLanguage('cpp')

function makeProgram(...body: SemanticNode[]): SemanticNode {
  return { id: 'root', componentId: 'cpp:program', properties: {}, children: { body } }
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
    const decl = createNode('cpp:var_declare', { name: 'x', type: 'int' }, {
      initializer: [createNode('cpp:literal_number', { value: '5' })],
    })
    const state = renderToBlocklyState(makeProgram(decl))
    expect(state.blocks.blocks).toHaveLength(1)
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_var_declare')
    expect(block.fields.TYPE).toBe('int')
    expect(block.fields.NAME_0).toBe('x')
    expect(block.inputs.INIT_0).toBeDefined()
    expect(block.inputs.INIT_0.block.type).toBe('cpp_literal_number')
  })

  it('should render var_assign', () => {
    const assign = createNode('cpp:var_assign', {}, {
        // 🟢 左值是接點（2026-08-25）——在此之前是 `obj: 'x'`
        target: [createNode('cpp:var_ref', { name: 'x' })],
      value: [createNode('cpp:var_ref', { name: 'y' })],
    })
    const state = renderToBlocklyState(makeProgram(assign))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_var_assign')
    // 🟢 `NAME` 那顆變數下拉換成 `TARGET` 接點（2026-08-25）
    expect(block.fields.NAME, '🔴 欄位長回來了').toBeUndefined()
    expect(block.inputs.TARGET.block.fields.NAME).toBe('x')
    expect(block.inputs.VALUE.block.type).toBe('cpp_var_ref')
  })

  it('should render arithmetic expression', () => {
    const expr = createNode('cpp:arithmetic', { operator: '+' }, {
      left: [createNode('cpp:var_ref', { name: 'a' })],
      right: [createNode('cpp:literal_number', { value: '1' })],
    })
    const assign = createNode('cpp:var_assign', {}, {
        // 🟢 左值是接點（2026-08-25）——在此之前是 `obj: 'x'`
        target: [createNode('cpp:var_ref', { name: 'x' })], value: [expr] })
    const state = renderToBlocklyState(makeProgram(assign))
    const block = state.blocks.blocks[0]
    expect(block.inputs.VALUE.block.type).toBe('cpp_arithmetic')
    expect(block.inputs.VALUE.block.fields.OP).toBe('+')
  })

  it('should render if with else', () => {
    const ifStmt = createNode('cpp:if', {}, {
      condition: [createNode('cpp:var_ref', { name: 'x' })],
      then_body: [createNode('cpp:break', {})],
      else_body: [createNode('cpp:continue', {})],
    })
    const state = renderToBlocklyState(makeProgram(ifStmt))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_if')
    expect(block.inputs.CONDITION).toBeDefined()
    expect(block.inputs.THEN).toBeDefined()
    expect(block.inputs.ELSE).toBeDefined()
    expect(block.extraState).toEqual({ hasElse: true })
  })

  it('should render if without else as cpp_if', () => {
    const ifStmt = createNode('cpp:if', {}, {
      condition: [createNode('cpp:var_ref', { name: 'x' })],
      then_body: [createNode('cpp:break', {})],
      else_body: [],
    })
    const state = renderToBlocklyState(makeProgram(ifStmt))
    expect(state.blocks.blocks[0].type).toBe('cpp_if')
  })

  it('should chain statement blocks via next', () => {
    const s1 = createNode('cpp:break', {})
    const s2 = createNode('cpp:continue', {})
    const state = renderToBlocklyState(makeProgram(s1, s2))
    expect(state.blocks.blocks).toHaveLength(1)
    const first = state.blocks.blocks[0]
    expect(first.type).toBe('cpp_break')
    expect(first.next.block.type).toBe('cpp_continue')
  })

  it('should render func_def', () => {
    const func = createNode('cpp:func_def', {
      name: 'main', return_type: 'int',
    }, {
      params: [
        createNode('param_decl', { type: 'int', name: 'a' }),
        createNode('param_decl', { type: 'int', name: 'b' }),
      ],
      body: [createNode('cpp:return', {}, { value: [createNode('cpp:literal_number', { value: '0' })] })],
    })
    const state = renderToBlocklyState(makeProgram(func))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_func_def')
    expect(block.fields.NAME).toBe('main')
    expect(block.fields.RETURN_TYPE).toBe('int')
  })

  it('should render print with values', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:endl', {}),
      ],
    })
    const state = renderToBlocklyState(makeProgram(print))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_print')
    expect(block.inputs.EXPR0).toBeDefined()
    expect(block.inputs.EXPR1).toBeDefined()
  })

  /**
   * 🔄 **2026-08-26：兩顆格式化 I/O 改用宣告式的可變參數建構子**——
   * 每一格從「變數下拉／接點二選一」（`{args:[{mode,text}]}`）
   * 變成**單純的接點**（`{itemCount}` ＋ `ARG_{i}`）。
   *
   * 理由與 `cin >>` 同一條：左值接點化之後那個 select 模式只剩
   * 「少一層巢狀」，而它的代價是同族的積木投影不一致。
   */
  it('should render cpp_printf with format and args', () => {
    const printf = createNode('cpp:print_formatted', { format: '%.2f\\n' }, {
      args: [createNode('cpp:var_ref', { name: 'x' })],
    })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_print_formatted')
    expect(block.fields.FORMAT).toBe('%.2f\\n')
    expect(block.extraState.args, '🔴 舊的記憶方式長回來了').toBeUndefined()
    expect(block.extraState.itemCount).toBe(1)
    expect(block.inputs.ARG_0.block.fields.NAME).toBe('x')
  })

  it('should render cpp_printf with no args', () => {
    const printf = createNode('cpp:print_formatted', { format: 'hello\\n' }, { args: [] })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_print_formatted')
    expect(block.fields.FORMAT).toBe('hello\\n')
    // ⚠️ 沒有參數時**不設 itemCount**（渲染器的 `inputPattern` 路遇到空陣列就跳過）
    //    ——載入時會落回 `minCount`。
    expect(block.inputs.ARG_0).toBeUndefined()
  })

  it('should render cpp_scanf with format and args', () => {
    const scanf = createNode('cpp:input_formatted', { format: '%d %d' }, {
      args: [
        createNode('cpp:var_ref', { name: 'a' }),
        createNode('cpp:var_ref', { name: 'b' }),
      ],
    })
    const state = renderToBlocklyState(makeProgram(scanf))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_input_formatted')
    expect(block.fields.FORMAT).toBe('%d %d')
    expect(block.extraState.itemCount).toBe(2)
    expect(block.inputs.ARG_0.block.fields.NAME).toBe('a')
    expect(block.inputs.ARG_1.block.fields.NAME, '🔴 第二格掉了').toBe('b')
  })

  it('🎯 參數是運算式時走同一條路——不再需要「另一種模式」', () => {
    const printf = createNode('cpp:print_formatted', { format: 'sum=%d\\n' }, {
      args: [createNode('cpp:arithmetic', { operator: '+' }, {
        left: [createNode('cpp:var_ref', { name: 'x' })],
        right: [createNode('cpp:var_ref', { name: 'y' })],
      })],
    })
    const state = renderToBlocklyState(makeProgram(printf))
    const block = state.blocks.blocks[0]
    expect(block.fields.FORMAT).toBe('sum=%d\\n')
    expect(block.extraState.itemCount).toBe(1)
    expect(block.inputs.ARG_0.block.type).toBe('cpp_arithmetic')
  })

  it('should render raw_code as cpp_raw_code', () => {
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: 'auto x = 5;' }
    const state = renderToBlocklyState(makeProgram(raw))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_raw_code')
    expect(block.fields.CODE).toBe('auto x = 5;')
  })

  it('should render cpp_increment in expression context as cpp_increment_expression', () => {
    const forLoop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '0' })],
      })],
      cond: [createNode('cpp:compare', { operator: '<' }, {
        left: [createNode('cpp:var_ref', { name: 'i' })],
        right: [createNode('cpp:literal_number', { value: '10' })],
      })],
      update: [createNode('cpp:increment', { operator: '++', position: 'postfix' }, { target: [createNode('cpp:var_ref', { name: 'i' })] })],
      body: [createNode('cpp:break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    expect(block.type).toBe('cpp_loop_for')
    // UPDATE input should use expression block, not raw expression
    const updateBlock = block.inputs.UPDATE?.block
    expect(updateBlock).toBeDefined()
    expect(updateBlock.type).toBe('cpp_increment_expression')
    // 🟢 **運算元是接點**（2026-08-25）——`NAME` 那顆變數下拉換成 `TARGET`。
    expect(updateBlock.fields.NAME, '🔴 欄位長回來了').toBeUndefined()
    expect(updateBlock.inputs.TARGET?.block?.type).toBe('cpp_var_ref')
    expect(updateBlock.fields.OP).toBe('++')
  })

  it('should render cpp_compound_assign in expression context as cpp_var_assign_compound_expression', () => {
    const forLoop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_ref', { name: 'i' })],
      cond: [createNode('cpp:var_ref', { name: 'x' })],
      update: [createNode('cpp:var_assign_compound', { operator: '+=' }, {
        // 🟢 左值是接點（2026-08-25）——在此之前是 `name: 'j'`
        target: [createNode('cpp:var_ref', { name: 'j' })],
        value: [createNode('cpp:var_ref', { name: 'i' })],
      })],
      body: [createNode('cpp:break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    const updateBlock = block.inputs.UPDATE?.block
    expect(updateBlock).toBeDefined()
    expect(updateBlock.type).toBe('cpp_var_assign_compound_expression')
    // 🟢 **左值是接點**（2026-08-25）——`NAME` 那顆變數下拉換成 `TARGET`。
    //    釘接點比釘欄位強：它證明左邊真的被渲成一顆積木，而不是一段文字。
    expect(updateBlock.fields.NAME, '🔴 欄位長回來了').toBeUndefined()
    expect(updateBlock.inputs.TARGET?.block?.type).toBe('cpp_var_ref')
    expect(updateBlock.fields.OP).toBe('+=')
  })

  it('should render var_declare in expression context as cpp_var_declare_expression', () => {
    const forLoop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '2' })],
      })],
      cond: [createNode('cpp:var_ref', { name: 'x' })],
      update: [createNode('cpp:var_ref', { name: 'i' })],
      body: [createNode('cpp:break', {})],
    })
    const state = renderToBlocklyState(makeProgram(forLoop))
    const block = state.blocks.blocks[0]
    const initBlock = block.inputs.INIT?.block
    expect(initBlock).toBeDefined()
    expect(initBlock.type).toBe('cpp_var_declare_expression')
    expect(initBlock.fields.TYPE).toBe('int')
    expect(initBlock.fields.NAME_0).toBe('i')
    expect(initBlock.inputs.INIT_0).toBeDefined()
  })
})
