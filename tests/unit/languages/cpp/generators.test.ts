import { describe, it, expect, beforeAll } from 'vitest'
import { generateCode } from '../../../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../../../src/languages/cpp/generators'
import { createNode } from '../../../../src/core/semantic-tree'
import type { SemanticNode, StylePreset } from '../../../../src/core/types'

const apcsStyle: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

const printfStyle: StylePreset = {
  ...apcsStyle,
  id: 'competitive',
  io_style: 'printf',
}

function makeProgram(...body: SemanticNode[]): SemanticNode {
  return { id: 'root', concept: 'program', properties: {}, children: { body } }
}

beforeAll(() => {
  registerCppLanguage()
})

describe('C++ declarations generator', () => {
  it('should generate array declaration', () => {
    const arr = createNode('array_declare', { type: 'int', name: 'arr', size: '100' })
    const code = generateCode(makeProgram(arr), 'cpp', apcsStyle)
    expect(code).toBe('int arr[100];')
  })

  it('should generate array access in expression', () => {
    const access = createNode('array_access', { name: 'arr' }, {
      index: [createNode('var_ref', { name: 'i' })],
    })
    const assign = createNode('var_assign', { name: 'x' }, { value: [access] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = arr[i];')
  })
})

describe('C++ expressions generator', () => {
  it('should generate comparison', () => {
    const cmp = createNode('compare', { operator: '>=' }, {
      left: [createNode('var_ref', { name: 'a' })],
      right: [createNode('number_literal', { value: '0' })],
    })
    const assign = createNode('var_assign', { name: 'result' }, { value: [cmp] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('result = a >= 0;')
  })

  it('should generate logic expression', () => {
    const logic = createNode('logic', { operator: '||' }, {
      left: [createNode('var_ref', { name: 'a' })],
      right: [createNode('var_ref', { name: 'b' })],
    })
    const assign = createNode('var_assign', { name: 'x' }, { value: [logic] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = a || b;')
  })

  it('should generate logic_not', () => {
    const notExpr = createNode('logic_not', {}, {
      operand: [createNode('var_ref', { name: 'done' })],
    })
    const assign = createNode('var_assign', { name: 'x' }, { value: [notExpr] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = !done;')
  })

  it('should generate negate', () => {
    const neg = createNode('negate', {}, {
      value: [createNode('var_ref', { name: 'x' })],
    })
    const assign = createNode('var_assign', { name: 'y' }, { value: [neg] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('y = -x;')
  })

  it('should generate string literal', () => {
    const str = createNode('string_literal', { value: 'hello' })
    const decl = createNode('var_declare', { name: 's', type: 'string' }, { initializer: [str] })
    const code = generateCode(makeProgram(decl), 'cpp', apcsStyle)
    expect(code).toBe('string s = "hello";')
  })
})

describe('C++ statements generator', () => {
  it('should generate if-else', () => {
    const ifStmt = createNode('if', {}, {
      condition: [createNode('var_ref', { name: 'x' })],
      then_body: [createNode('var_assign', { name: 'y' }, { value: [createNode('number_literal', { value: '1' })] })],
      else_body: [createNode('var_assign', { name: 'y' }, { value: [createNode('number_literal', { value: '2' })] })],
    })
    const code = generateCode(makeProgram(ifStmt), 'cpp', apcsStyle)
    expect(code).toContain('if (x) {')
    expect(code).toContain('} else {')
    expect(code).toContain('y = 1;')
    expect(code).toContain('y = 2;')
  })

  it('should generate count_loop (for)', () => {
    const loop = createNode('count_loop', { var_name: 'i' }, {
      from: [createNode('number_literal', { value: '0' })],
      to: [createNode('number_literal', { value: '10' })],
      body: [createNode('break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int i = 0; i < 10; i++) {')
    expect(code).toContain('break;')
  })

  it('should generate count_loop with inclusive', () => {
    const loop = createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
      from: [createNode('number_literal', { value: '1' })],
      to: [createNode('number_literal', { value: '10' })],
      body: [createNode('break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int i = 1; i <= 10; i++) {')
  })

  it('should generate cpp_for_loop (three-part)', () => {
    const loop = createNode('cpp_for_loop', {}, {
      init: [createNode('var_assign', { name: 'i' }, {
        value: [createNode('number_literal', { value: '0' })],
      })],
      cond: [createNode('compare', { operator: '<' }, {
        left: [createNode('var_ref', { name: 'i' })],
        right: [createNode('number_literal', { value: '10' })],
      })],
      update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' })],
      body: [createNode('break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (i = 0; i < 10; i++)')
    expect(code).toContain('break;')
  })

  it('should generate compound assignment', () => {
    const stmt = createNode('cpp_compound_assign', { name: 'x', operator: '+=' }, {
      value: [createNode('number_literal', { value: '5' })],
    })
    const code = generateCode(makeProgram(stmt), 'cpp', apcsStyle)
    expect(code).toBe('x += 5;')
  })

  it('should generate cpp_increment', () => {
    const stmt = createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' })
    const code = generateCode(makeProgram(stmt), 'cpp', apcsStyle)
    expect(code).toBe('i++;')
  })

  it('should generate break and continue', () => {
    const code = generateCode(makeProgram(
      createNode('break', {}),
      createNode('continue', {}),
    ), 'cpp', apcsStyle)
    expect(code).toContain('break;')
    expect(code).toContain('continue;')
  })

  it('should generate func_call', () => {
    const call = createNode('func_call', { name: 'solve' }, {
      args: [createNode('var_ref', { name: 'n' }), createNode('number_literal', { value: '42' })],
    })
    const code = generateCode(makeProgram(call), 'cpp', apcsStyle)
    expect(code).toBe('solve(n, 42);')
  })

  it('should generate return without value', () => {
    const ret = createNode('return', {})
    const code = generateCode(makeProgram(ret), 'cpp', apcsStyle)
    expect(code).toBe('return;')
  })
})

describe('C++ I/O generator', () => {
  it('should generate cout with multiple values', () => {
    const print = createNode('print', {}, {
      values: [
        createNode('var_ref', { name: 'x' }),
        createNode('endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', apcsStyle)
    expect(code).toBe('cout << x << endl;')
  })

  it('should generate cin', () => {
    const input = createNode('input', { variable: 'n' })
    const code = generateCode(makeProgram(input), 'cpp', apcsStyle)
    expect(code).toBe('cin >> n;')
  })

  it('should generate printf style', () => {
    const print = createNode('print', {}, {
      values: [createNode('var_ref', { name: 'x' })],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf')
  })

  it('should generate scanf style', () => {
    const input = createNode('input', { variable: 'n' })
    const code = generateCode(makeProgram(input), 'cpp', printfStyle)
    expect(code).toContain('scanf')
    expect(code).toContain('&n')
  })

  it('should generate printf with endl as \\n in format string', () => {
    const print = createNode('print', {}, {
      values: [
        createNode('var_ref', { name: 'x' }),
        createNode('endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf')
    expect(code).toContain('\\n')
    expect(code).not.toContain('endl')
  })

  it('should generate printf with only endl as newline', () => {
    const print = createNode('print', {}, {
      values: [createNode('endl', {})],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("\\n")')
  })

  it('should generate printf without endl (no trailing newline)', () => {
    const print = createNode('print', {}, {
      values: [createNode('var_ref', { name: 'x' })],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("%d", x)')
    expect(code).not.toContain('\\n')
  })

  it('should generate printf with multiple values and endl', () => {
    const print = createNode('print', {}, {
      values: [
        createNode('var_ref', { name: 'a' }),
        createNode('var_ref', { name: 'b' }),
        createNode('endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("%d %d\\n", a, b)')
  })
})
