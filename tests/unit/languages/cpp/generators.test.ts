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
  return { id: 'root', conceptId: 'cpp:program', properties: {}, children: { body } }
}

beforeAll(() => {
  registerCppLanguage()
})

describe('C++ declarations generator', () => {
  it('should generate array declaration', () => {
    const arr = createNode('cpp:array_declare', { type: 'int', name: 'arr', size: '100' })
    const code = generateCode(makeProgram(arr), 'cpp', apcsStyle)
    expect(code).toBe('int arr[100];')
  })

  it('should generate array access in expression', () => {
    const access = createNode('cpp:array_at', { obj: 'arr' }, {
      index: [createNode('cpp:var_ref', { name: 'i' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [access] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = arr[i];')
  })
})

describe('C++ expressions generator', () => {
  it('should generate comparison', () => {
    const cmp = createNode('cpp:compare', { operator: '>=' }, {
      left: [createNode('cpp:var_ref', { name: 'a' })],
      right: [createNode('cpp:literal_number', { value: '0' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'result' }, { value: [cmp] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('result = a >= 0;')
  })

  it('should generate logic expression', () => {
    const logic = createNode('cpp:logic', { operator: '||' }, {
      left: [createNode('cpp:var_ref', { name: 'a' })],
      right: [createNode('cpp:var_ref', { name: 'b' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [logic] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = a || b;')
  })

  it('should generate logic_not', () => {
    const notExpr = createNode('cpp:logic_not', {}, {
      operand: [createNode('cpp:var_ref', { name: 'done' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [notExpr] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = !done;')
  })

  it('should generate negate', () => {
    const neg = createNode('cpp:negate', {}, {
      value: [createNode('cpp:var_ref', { name: 'x' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'y' }, { value: [neg] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('y = -x;')
  })

  it('should generate string literal', () => {
    const str = createNode('cpp:literal_string', { value: 'hello' })
    const decl = createNode('cpp:var_declare', { name: 's', type: 'string' }, { initializer: [str] })
    const code = generateCode(makeProgram(decl), 'cpp', apcsStyle)
    expect(code).toBe('string s = "hello";')
  })
})

describe('C++ statements generator', () => {
  it('should generate if-else', () => {
    const ifStmt = createNode('cpp:if', {}, {
      condition: [createNode('cpp:var_ref', { name: 'x' })],
      then_body: [createNode('cpp:var_assign', { obj: 'y' }, { value: [createNode('cpp:literal_number', { value: '1' })] })],
      else_body: [createNode('cpp:var_assign', { obj: 'y' }, { value: [createNode('cpp:literal_number', { value: '2' })] })],
    })
    const code = generateCode(makeProgram(ifStmt), 'cpp', apcsStyle)
    expect(code).toContain('if (x) {')
    expect(code).toContain('} else {')
    expect(code).toContain('y = 1;')
    expect(code).toContain('y = 2;')
  })

  it('should generate count_loop (for)', () => {
    const loop = createNode('cpp:loop_count', { var_name: 'i' }, {
      from: [createNode('cpp:literal_number', { value: '0' })],
      to: [createNode('cpp:literal_number', { value: '10' })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int i = 0; i < 10; i++) {')
    expect(code).toContain('break;')
  })

  it('should generate count_loop with inclusive', () => {
    const loop = createNode('cpp:loop_count', { var_name: 'i', inclusive: 'TRUE' }, {
      from: [createNode('cpp:literal_number', { value: '1' })],
      to: [createNode('cpp:literal_number', { value: '10' })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int i = 1; i <= 10; i++) {')
  })

  it('should generate cpp_for_loop (three-part)', () => {
    const loop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_assign', { obj: 'i' }, {
        value: [createNode('cpp:literal_number', { value: '0' })],
      })],
      cond: [createNode('cpp:compare', { operator: '<' }, {
        left: [createNode('cpp:var_ref', { name: 'i' })],
        right: [createNode('cpp:literal_number', { value: '10' })],
      })],
      update: [createNode('cpp:increment', { name: 'i', operator: '++', position: 'postfix' })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (i = 0; i < 10; i++)')
    expect(code).toContain('break;')
  })

  it('should generate cpp_compound_assign', () => {
    const stmt = createNode('cpp:var_assign_compound', { name: 'x', operator: '+=' }, {
      value: [createNode('cpp:literal_number', { value: '5' })],
    })
    const code = generateCode(makeProgram(stmt), 'cpp', apcsStyle)
    expect(code).toBe('x += 5;')
  })

  it('should generate array_assign', () => {
    const stmt = createNode('cpp:array_assign', { obj: 'arr' }, {
      index: [createNode('cpp:var_ref', { name: 'i' })],
      value: [createNode('cpp:literal_number', { value: '1' })],
    })
    const code = generateCode(makeProgram(stmt), 'cpp', apcsStyle)
    expect(code).toBe('arr[i] = 1;')
  })

  it('should generate cpp_increment', () => {
    const stmt = createNode('cpp:increment', { name: 'i', operator: '++', position: 'postfix' })
    const code = generateCode(makeProgram(stmt), 'cpp', apcsStyle)
    expect(code).toBe('i++;')
  })

  it('should generate break and continue', () => {
    const code = generateCode(makeProgram(
      createNode('cpp:break', {}),
      createNode('cpp:continue', {}),
    ), 'cpp', apcsStyle)
    expect(code).toContain('break;')
    expect(code).toContain('continue;')
  })

  it('should generate func_call', () => {
    const call = createNode('cpp:func_call', { name: 'solve' }, {
      args: [createNode('cpp:var_ref', { name: 'n' }), createNode('cpp:literal_number', { value: '42' })],
    })
    const code = generateCode(makeProgram(call), 'cpp', apcsStyle)
    expect(code).toBe('solve(n, 42);')
  })

  it('should generate return without value', () => {
    const ret = createNode('cpp:return', {})
    const code = generateCode(makeProgram(ret), 'cpp', apcsStyle)
    expect(code).toBe('return;')
  })
})

describe('C++ I/O generator', () => {
  it('should generate cout with multiple values', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', apcsStyle)
    expect(code).toBe('cout << x << endl;')
  })

  it('should generate cin', () => {
    const input = createNode('cpp:input', {}, { values: [createNode('cpp:var_ref', { name: 'n' })] })
    const code = generateCode(makeProgram(input), 'cpp', apcsStyle)
    expect(code).toBe('cin >> n;')
  })

  it('should generate printf style', () => {
    const print = createNode('cpp:print', {}, {
      values: [createNode('cpp:var_ref', { name: 'x' })],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf')
  })

  it('should generate scanf style', () => {
    const input = createNode('cpp:input', {}, { values: [createNode('cpp:var_ref', { name: 'n' })] })
    const code = generateCode(makeProgram(input), 'cpp', printfStyle)
    expect(code).toContain('scanf')
    expect(code).toContain('&n')
  })

  it('should generate printf with endl as \\n in format string', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf')
    expect(code).toContain('\\n')
    expect(code).not.toContain('endl')
  })

  it('should generate printf with only endl as newline', () => {
    const print = createNode('cpp:print', {}, {
      values: [createNode('cpp:endl', {})],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("\\n")')
  })

  it('should generate printf without endl (no trailing newline)', () => {
    const print = createNode('cpp:print', {}, {
      values: [createNode('cpp:var_ref', { name: 'x' })],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("%d", x)')
    expect(code).not.toContain('\\n')
  })

  it('should generate printf with multiple values and endl', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:var_ref', { name: 'a' }),
        createNode('cpp:var_ref', { name: 'b' }),
        createNode('cpp:endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("%d%d\\n", a, b)')
  })

  it('should generate printf with string_literal embedded in format', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:literal_string', { value: 'Done' }),
        createNode('cpp:endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("Done\\n")')
  })

  it('should generate printf with mixed types: string embedded and int as arg', () => {
    const print = createNode('cpp:print', {}, {
      values: [
        createNode('cpp:literal_string', { value: 'ans=' }),
        createNode('cpp:var_ref', { name: 'x' }),
        createNode('cpp:endl', {}),
      ],
    })
    const code = generateCode(makeProgram(print), 'cpp', printfStyle)
    expect(code).toContain('printf("ans=%d\\n", x)')
  })
})

describe('C++ header deduplication', () => {
  it('should deduplicate identical #include directives', () => {
    const inc1 = createNode('cpp:include', { header: 'cstdio', local: false })
    const inc2 = createNode('cpp:include', { header: 'cstdio', local: false })
    const main = createNode('cpp:func_def', { name: 'main', return_type: 'int' }, { params: [], body: [] })
    const code = generateCode(makeProgram(inc1, inc2, main), 'cpp', printfStyle)
    const matches = code.match(/#include <cstdio>/g)
    expect(matches).toHaveLength(1)
  })

  it('should keep different #include directives', () => {
    const inc1 = createNode('cpp:include', { header: 'cstdio', local: false })
    const inc2 = createNode('cpp:include', { header: 'cstring', local: false })
    const code = generateCode(makeProgram(inc1, inc2), 'cpp', printfStyle)
    expect(code).toContain('#include <cstdio>')
    expect(code).toContain('#include <cstring>')
  })
})

describe('C++ expression generators (for expression blocks)', () => {
  it('should generate cpp_increment_expr postfix', () => {
    // Expression context: no indent, no semicolons
    const node = createNode('cpp:increment', { name: 'i', operator: '++', position: 'postfix' })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [node] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = i++;')
  })

  it('should generate cpp_increment_expr prefix', () => {
    const node = createNode('cpp:increment', { name: 'j', operator: '--', position: 'prefix' })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [node] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = --j;')
  })

  it('should generate cpp_compound_assign_expr', () => {
    const node = createNode('cpp:var_assign_compound', { name: 'j', operator: '+=' }, {
      value: [createNode('cpp:var_ref', { name: 'i' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [node] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = j += i;')
  })

  it('should generate cpp_scanf_expr', () => {
    const node = createNode('cpp:input_formatted', { format: '%d' }, {
      args: [createNode('cpp:var_ref', { name: 'n' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [node] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = scanf("%d", &n);')
  })

  it('should generate var_declare_expr', () => {
    const node = createNode('cpp:var_declare', { name: 'i', type: 'int' }, {
      initializer: [createNode('cpp:literal_number', { value: '2' })],
    })
    const assign = createNode('cpp:var_assign', { obj: 'x' }, { value: [node] })
    const code = generateCode(makeProgram(assign), 'cpp', apcsStyle)
    expect(code).toBe('x = int i = 2;')
  })

  it('should work in cpp_for_loop init/cond/update', () => {
    const loop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '2' })],
      })],
      cond: [createNode('cpp:compare', { operator: '<=' }, {
        left: [createNode('cpp:arithmetic', { operator: '*' }, {
          left: [createNode('cpp:var_ref', { name: 'i' })],
          right: [createNode('cpp:var_ref', { name: 'i' })],
        })],
        right: [createNode('cpp:var_ref', { name: 'max' })],
      })],
      update: [createNode('cpp:var_assign_compound', { name: 'j', operator: '+=' }, {
        value: [createNode('cpp:var_ref', { name: 'i' })],
      })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int i = 2; i * i <= max; j += i)')
  })

  it('should generate cpp_increment_expr in for-loop update via template fallback', () => {
    const loop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_declare', { name: 'm', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '0' })],
      })],
      cond: [createNode('cpp:compare', { operator: '<' }, {
        left: [createNode('cpp:var_ref', { name: 'm' })],
        right: [createNode('cpp:literal_number', { value: '10' })],
      })],
      update: [createNode('cpp:increment', { name: 'm', operator: '++', position: 'postfix' })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int m = 0; m < 10; m++)')
  })

  it('should generate cpp_scanf_expr in while condition', () => {
    const whileLoop = createNode('cpp:loop_while', {}, {
      condition: [createNode('cpp:compare', { operator: '!=' }, {
        left: [createNode('cpp:input_formatted', { format: '%d' }, {
          args: [createNode('cpp:var_ref', { name: 'n' })],
        })],
        right: [createNode('cpp:var_ref', { name: 'EOF' })],
      })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(whileLoop), 'cpp', apcsStyle)
    expect(code).toContain('while (scanf("%d", &n) != EOF)')
  })

  it('should generate array_assign inside for-loop body via template fallback', () => {
    const loop = createNode('cpp:loop_count', { var_name: 'i' }, {
      from: [createNode('cpp:literal_number', { value: '0' })],
      to: [createNode('cpp:literal_number', { value: '10' })],
      body: [createNode('cpp:array_assign', { obj: 'arr' }, {
        index: [createNode('cpp:var_ref', { name: 'i' })],
        value: [createNode('cpp:literal_number', { value: '1' })],
      })],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('arr[i] = 1;')
    expect(code).not.toContain('unknown')
  })

  it('should generate cpp_increment inside do-while body via template fallback', () => {
    const doWhile = createNode('cpp:loop_do_while', {}, {
      body: [createNode('cpp:increment', { name: 'i', operator: '++', position: 'postfix' })],
      cond: [createNode('cpp:var_ref', { name: 'x' })],
    })
    const code = generateCode(makeProgram(doWhile), 'cpp', apcsStyle)
    expect(code).toContain('i++;')
    expect(code).not.toContain('unknown')
  })

  it('should generate ternary with func_call_expr in condition', () => {
    const ternary = createNode('cpp:ternary', {}, {
      condition: [createNode('cpp:func_call', { name: 'isPrime' }, {
        args: [createNode('cpp:var_ref', { name: 'n' })],
      })],
      true_expr: [createNode('cpp:literal_string', { value: '質數' })],
      false_expr: [createNode('cpp:literal_string', { value: '非質數' })],
    })
    const printNode = createNode('cpp:print', {}, {
      values: [createNode('cpp:literal_string', { value: '%s\\n' }), ternary],
    })
    const code = generateCode(makeProgram(printNode), 'cpp', apcsStyle)
    expect(code).toContain('isPrime(n)')
    expect(code).toContain('?')
    expect(code).not.toContain('/* func_call_expr */')
  })

  it('should generate do-while with array_access and logic_not in condition', () => {
    const doWhile = createNode('cpp:loop_do_while', {}, {
      body: [createNode('cpp:increment', { name: 'i', operator: '++', position: 'postfix' })],
      cond: [createNode('cpp:logic', { operator: '&&' }, {
        left: [createNode('cpp:compare', { operator: '<=' }, {
          left: [createNode('cpp:arithmetic', { operator: '*' }, {
            left: [createNode('cpp:var_ref', { name: 'i' })],
            right: [createNode('cpp:var_ref', { name: 'i' })],
          })],
          right: [createNode('cpp:var_ref', { name: 'max' })],
        })],
        right: [createNode('cpp:logic_not', {}, {
          operand: [createNode('cpp:array_at', { obj: 'sieve' }, {
            index: [createNode('cpp:var_ref', { name: 'i' })],
          })],
        })],
      })],
    })
    const code = generateCode(makeProgram(doWhile), 'cpp', apcsStyle)
    expect(code).toContain('i * i <= max')
    expect(code).toContain('!sieve[i]')
    expect(code).not.toContain('/* array_access */')
    expect(code).not.toContain('/* cpp_increment */')
  })

  it('should generate structured forward_decl with return_type and params', () => {
    const fwd1 = createNode('cpp:forward_decl', {
      return_type: 'void',
      name: 'listp',
    }, {
      params: [
        createNode('param_decl', { type: 'int *' }),
        createNode('param_decl', { type: 'int' }),
      ],
    })
    const fwd2 = createNode('cpp:forward_decl', {
      return_type: 'int',
      name: 'checkp',
    }, {
      params: [
        createNode('param_decl', { type: 'int' }),
        createNode('param_decl', { type: 'int *' }),
      ],
    })
    const code = generateCode(makeProgram(fwd1, fwd2), 'cpp', apcsStyle)
    expect(code).toContain('void listp(int *, int);')
    expect(code).toContain('int checkp(int, int *);')
    expect(code).not.toContain('void void')
  })

  it('should generate forward_decl with no params', () => {
    const fwd = createNode('cpp:forward_decl', {
      return_type: 'int',
      name: 'getVal',
    }, { params: [] })
    const code = generateCode(makeProgram(fwd), 'cpp', apcsStyle)
    expect(code).toContain('int getVal();')
  })

  it('should generate structured forward_decl', () => {
    const fwd = createNode('cpp:forward_decl', {
      return_type: 'void',
      name: 'listp',
    }, {
      params: [
        createNode('param_decl', { type: 'int *' }),
        createNode('param_decl', { type: 'int' }),
      ],
    })
    const code = generateCode(makeProgram(fwd), 'cpp', apcsStyle)
    expect(code).toContain('void listp(int *, int);')
    expect(code).not.toContain('void void')
  })

  it('should generate cpp_compound_assign_expr in for-loop update', () => {
    const loop = createNode('cpp:loop_for', {}, {
      init: [createNode('cpp:var_declare', { type: 'int', name: 'j' }, {
        initializer: [createNode('cpp:arithmetic', { operator: '*' }, {
          left: [createNode('cpp:var_ref', { name: 'i' })],
          right: [createNode('cpp:var_ref', { name: 'i' })],
        })],
      })],
      cond: [createNode('cpp:compare', { operator: '<=' }, {
        left: [createNode('cpp:var_ref', { name: 'j' })],
        right: [createNode('cpp:var_ref', { name: 'max' })],
      })],
      update: [createNode('cpp:var_assign_compound', { name: 'j', operator: '+=' }, {
        value: [createNode('cpp:var_ref', { name: 'i' })],
      })],
      body: [createNode('cpp:array_assign', { obj: 'sieve' }, {
        index: [createNode('cpp:var_ref', { name: 'j' })],
        value: [createNode('cpp:literal_number', { value: '1' })],
      })],
    })
    const code = generateCode(makeProgram(loop), 'cpp', apcsStyle)
    expect(code).toContain('for (int j = i * i; j <= max; j += i)')
    expect(code).toContain('sieve[j] = 1;')
  })

  it('should generate builtin_constant values directly', () => {
    const code = generateCode(makeProgram(
      createNode('cpp:print', {}, {
        values: [
          createNode('cpp:builtin_constant', { value: 'true' }),
          createNode('cpp:builtin_constant', { value: 'false' }),
          createNode('cpp:builtin_constant', { value: 'EOF' }),
          createNode('cpp:builtin_constant', { value: 'NULL' }),
          createNode('cpp:builtin_constant', { value: 'nullptr' }),
        ],
      })
    ), 'cpp', apcsStyle)
    expect(code).toContain('true')
    expect(code).toContain('false')
    expect(code).toContain('EOF')
    expect(code).toContain('NULL')
    expect(code).toContain('nullptr')
  })

  it('should use builtin_constant in while condition with EOF', () => {
    const whileLoop = createNode('cpp:loop_while', {}, {
      condition: [createNode('cpp:compare', { operator: '!=' }, {
        left: [createNode('cpp:input_formatted', { format: '%d' }, {
          args: [createNode('cpp:var_ref', { name: 'n' })],
        })],
        right: [createNode('cpp:builtin_constant', { value: 'EOF' })],
      })],
      body: [createNode('cpp:break', {})],
    })
    const code = generateCode(makeProgram(whileLoop), 'cpp', apcsStyle)
    expect(code).toContain('!= EOF')
    expect(code).not.toContain('/* builtin_constant */')
  })
})
