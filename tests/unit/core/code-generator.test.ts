import { describe, it, expect, beforeAll } from 'vitest'
import { generateCode } from '../../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode, StylePreset } from '../../../src/core/types'

beforeAll(() => {
  registerCppLanguage()
})

const defaultStyle: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

function makeProgram(...body: SemanticNode[]): SemanticNode {
  return {
    id: 'test_root',
    concept: 'program',
    properties: {},
    children: { body },
  }
}

describe('generateCode', () => {
  it('should generate empty program', () => {
    const tree = makeProgram()
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toBe('')
  })

  it('should generate var declaration with initializer', () => {
    const value = createNode('number_literal', { value: '5' })
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [value] })
    const tree = makeProgram(decl)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('int x = 5;')
  })

  it('should generate var declaration without initializer', () => {
    const decl = createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [] })
    const tree = makeProgram(decl)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('int x;')
  })

  it('should generate var assignment', () => {
    const value = createNode('number_literal', { value: '10' })
    const assign = createNode('var_assign', { name: 'x' }, { value: [value] })
    const tree = makeProgram(assign)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('x = 10;')
  })

  it('should generate arithmetic expression', () => {
    const left = createNode('var_ref', { name: 'a' })
    const right = createNode('var_ref', { name: 'b' })
    const expr = createNode('arithmetic', { operator: '+' }, { left: [left], right: [right] })
    const assign = createNode('var_assign', { name: 'x' }, { value: [expr] })
    const tree = makeProgram(assign)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('x = a + b;')
  })

  it('should generate if statement', () => {
    const cond = createNode('var_ref', { name: 'x' })
    const body = createNode('var_assign', { name: 'y' }, { value: [createNode('number_literal', { value: '1' })] })
    const ifStmt = createNode('if', {}, {
      condition: [cond],
      then_body: [body],
      else_body: [],
    })
    const tree = makeProgram(ifStmt)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('if (x)')
    expect(code).toContain('y = 1;')
  })

  it('should generate while loop', () => {
    const cond = createNode('compare', { operator: '<' }, {
      left: [createNode('var_ref', { name: 'i' })],
      right: [createNode('number_literal', { value: '10' })],
    })
    const body = createNode('var_assign', { name: 'i' }, {
      value: [createNode('arithmetic', { operator: '+' }, {
        left: [createNode('var_ref', { name: 'i' })],
        right: [createNode('number_literal', { value: '1' })],
      })],
    })
    const loop = createNode('while_loop', {}, { condition: [cond], body: [body] })
    const tree = makeProgram(loop)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('while (i < 10)')
  })

  it('should generate function definition', () => {
    const ret = createNode('return', {}, { value: [createNode('number_literal', { value: '0' })] })
    const func = createNode('func_def', { name: 'main', return_type: 'int', params: [] }, { body: [ret] })
    const tree = makeProgram(func)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('int main()')
    expect(code).toContain('return 0;')
  })

  it('should generate cout print (APCS style)', () => {
    const val = createNode('var_ref', { name: 'x' })
    const print = createNode('print', {}, { values: [val] })
    const tree = makeProgram(print)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('cout << x')
  })

  it('should generate raw_code node', () => {
    const raw: SemanticNode = {
      id: 'test_raw',
      concept: 'raw_code',
      properties: {},
      children: {},
      metadata: { rawCode: 'template<typename T> class Foo {};' },
    }
    const tree = makeProgram(raw)
    const code = generateCode(tree, 'cpp', defaultStyle)
    expect(code).toContain('template<typename T> class Foo {};')
  })
})
