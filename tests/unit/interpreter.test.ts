import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/semantic-model'
import { createNode } from '../../src/core/semantic-model'
import { RuntimeError } from '../../src/interpreter/errors'

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

async function run(body: SemanticNode[], stdin: string[] = []) {
  const interp = new SemanticInterpreter()
  await interp.execute(makeProgram(body), stdin)
  return interp
}

// T009: 基礎概念
describe('Interpreter - basics', () => {
  it('should execute empty program', async () => {
    const interp = await run([])
    expect(interp.getState().status).toBe('completed')
    expect(interp.getOutput()).toEqual([])
  })

  it('should handle number_literal via print', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('number_literal', { value: '42' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('42')
  })

  it('should handle string_literal via print', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'hello' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('hello')
  })

  it('should declare and reference variable', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('number_literal', { value: '5' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('5')
  })

  it('should assign variable', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('number_literal', { value: '1' }, {})
      }),
      createNode('var_assign', { name: 'x' }, {
        value: createNode('number_literal', { value: '10' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('10')
  })

  it('should handle endl', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [
          createNode('string_literal', { value: 'a' }, {}),
          createNode('endl', {}, {})
        ]
      })
    ])
    expect(interp.getOutput().join('')).toBe('a\n')
  })
})

// T010: 運算概念
describe('Interpreter - arithmetic', () => {
  async function evalArith(op: string, left: string, right: string) {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: op }, {
          left: createNode('number_literal', { value: left }, {}),
          right: createNode('number_literal', { value: right }, {}),
        })]
      })
    ])
    return interp.getOutput().join('')
  }

  it('should add', async () => expect(await evalArith('+', '3', '4')).toBe('7'))
  it('should subtract', async () => expect(await evalArith('-', '10', '3')).toBe('7'))
  it('should multiply', async () => expect(await evalArith('*', '3', '4')).toBe('12'))
  it('should divide (integer truncation)', async () => expect(await evalArith('/', '7', '2')).toBe('3'))
  it('should modulo', async () => expect(await evalArith('%', '7', '3')).toBe('1'))

  it('should respect operator precedence (3 + 4 * 2 = 11)', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: createNode('number_literal', { value: '3' }, {}),
          right: createNode('arithmetic', { operator: '*' }, {
            left: createNode('number_literal', { value: '4' }, {}),
            right: createNode('number_literal', { value: '2' }, {}),
          }),
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('11')
  })
})

describe('Interpreter - compare', () => {
  async function evalCompare(op: string, left: string, right: string) {
    const interp = await run([
      createNode('var_declare', { name: 'r', type: 'bool' }, {
        initializer: createNode('compare', { operator: op }, {
          left: createNode('number_literal', { value: left }, {}),
          right: createNode('number_literal', { value: right }, {}),
        })
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'r' }, {})]
      })
    ])
    return interp.getOutput().join('')
  }

  it('should compare <', async () => expect(await evalCompare('<', '1', '2')).toBe('true'))
  it('should compare >', async () => expect(await evalCompare('>', '2', '1')).toBe('true'))
  it('should compare <=', async () => expect(await evalCompare('<=', '2', '2')).toBe('true'))
  it('should compare >=', async () => expect(await evalCompare('>=', '1', '2')).toBe('false'))
  it('should compare ==', async () => expect(await evalCompare('==', '3', '3')).toBe('true'))
  it('should compare !=', async () => expect(await evalCompare('!=', '3', '4')).toBe('true'))
})

describe('Interpreter - logic', () => {
  it('should evaluate && (true && false = false)', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('logic', { operator: '&&' }, {
          left: createNode('compare', { operator: '>' }, {
            left: createNode('number_literal', { value: '5' }, {}),
            right: createNode('number_literal', { value: '3' }, {}),
          }),
          right: createNode('compare', { operator: '<' }, {
            left: createNode('number_literal', { value: '5' }, {}),
            right: createNode('number_literal', { value: '3' }, {}),
          }),
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('false')
  })

  it('should evaluate logic_not', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('logic_not', {}, {
          operand: createNode('compare', { operator: '>' }, {
            left: createNode('number_literal', { value: '5' }, {}),
            right: createNode('number_literal', { value: '3' }, {}),
          }),
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('false')
  })
})

// T011: 流程控制
describe('Interpreter - control flow', () => {
  it('should execute if (true branch)', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('number_literal', { value: '5' }, {})
      }),
      createNode('if', {}, {
        condition: createNode('compare', { operator: '>' }, {
          left: createNode('var_ref', { name: 'x' }, {}),
          right: createNode('number_literal', { value: '0' }, {}),
        }),
        then_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'positive' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('positive')
  })

  it('should execute if with else_body', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('number_literal', { value: '-1' }, {})
      }),
      createNode('if', {}, {
        condition: createNode('compare', { operator: '>' }, {
          left: createNode('var_ref', { name: 'x' }, {}),
          right: createNode('number_literal', { value: '0' }, {}),
        }),
        then_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'positive' }, {})]
          })
        ],
        else_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'non-positive' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('non-positive')
  })

  it('should execute count_loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i' }, {
        from: createNode('number_literal', { value: '1' }, {}),
        to: createNode('number_literal', { value: '3' }, {}),
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('123')
  })

  it('should execute while_loop', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }, {
        initializer: createNode('number_literal', { value: '3' }, {})
      }),
      createNode('while_loop', {}, {
        condition: createNode('compare', { operator: '>' }, {
          left: createNode('var_ref', { name: 'n' }, {}),
          right: createNode('number_literal', { value: '0' }, {}),
        }),
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'n' }, {})]
          }),
          createNode('var_assign', { name: 'n' }, {
            value: createNode('arithmetic', { operator: '-' }, {
              left: createNode('var_ref', { name: 'n' }, {}),
              right: createNode('number_literal', { value: '1' }, {}),
            })
          }),
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('321')
  })

  it('should handle break in loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i' }, {
        from: createNode('number_literal', { value: '1' }, {}),
        to: createNode('number_literal', { value: '10' }, {}),
        body: [
          createNode('if', {}, {
            condition: createNode('compare', { operator: '>' }, {
              left: createNode('var_ref', { name: 'i' }, {}),
              right: createNode('number_literal', { value: '3' }, {}),
            }),
            then_body: [createNode('break', {}, {})],
          }),
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          }),
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('123')
  })

  it('should handle continue in loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i' }, {
        from: createNode('number_literal', { value: '1' }, {}),
        to: createNode('number_literal', { value: '5' }, {}),
        body: [
          createNode('if', {}, {
            condition: createNode('compare', { operator: '==' }, {
              left: createNode('var_ref', { name: 'i' }, {}),
              right: createNode('number_literal', { value: '3' }, {}),
            }),
            then_body: [createNode('continue', {}, {})],
          }),
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          }),
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('1245')
  })
})

// T012: 函式
describe('Interpreter - functions', () => {
  it('should define and call a simple function', async () => {
    const interp = await run([
      createNode('func_def', { name: 'greet', return_type: 'void', params: '[]' }, {
        body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'hi' }, {})]
          })
        ]
      }),
      createNode('func_call', { name: 'greet' }, { args: [] }),
    ])
    expect(interp.getOutput().join('')).toBe('hi')
  })

  it('should pass arguments and return value', async () => {
    const interp = await run([
      createNode('func_def', {
        name: 'double',
        return_type: 'int',
        params: JSON.stringify([{ type: 'int', name: 'n' }])
      }, {
        body: [
          createNode('return', {}, {
            value: createNode('arithmetic', { operator: '*' }, {
              left: createNode('var_ref', { name: 'n' }, {}),
              right: createNode('number_literal', { value: '2' }, {}),
            })
          })
        ]
      }),
      createNode('print', {}, {
        values: [createNode('func_call', { name: 'double' }, {
          args: [createNode('number_literal', { value: '7' }, {})]
        })]
      }),
    ])
    expect(interp.getOutput().join('')).toBe('14')
  })

  it('should handle recursion (factorial)', async () => {
    const interp = await run([
      createNode('func_def', {
        name: 'fact',
        return_type: 'int',
        params: JSON.stringify([{ type: 'int', name: 'n' }])
      }, {
        body: [
          createNode('if', {}, {
            condition: createNode('compare', { operator: '<=' }, {
              left: createNode('var_ref', { name: 'n' }, {}),
              right: createNode('number_literal', { value: '1' }, {}),
            }),
            then_body: [
              createNode('return', {}, {
                value: createNode('number_literal', { value: '1' }, {})
              })
            ],
          }),
          createNode('return', {}, {
            value: createNode('arithmetic', { operator: '*' }, {
              left: createNode('var_ref', { name: 'n' }, {}),
              right: createNode('func_call', { name: 'fact' }, {
                args: [createNode('arithmetic', { operator: '-' }, {
                  left: createNode('var_ref', { name: 'n' }, {}),
                  right: createNode('number_literal', { value: '1' }, {}),
                })]
              }),
            })
          }),
        ]
      }),
      createNode('print', {}, {
        values: [createNode('func_call', { name: 'fact' }, {
          args: [createNode('number_literal', { value: '5' }, {})]
        })]
      }),
    ])
    expect(interp.getOutput().join('')).toBe('120')
  })
})

// T013: 陣列
describe('Interpreter - arrays', () => {
  it('should declare and access array', async () => {
    const interp = await run([
      createNode('array_declare', { name: 'arr', type: 'int', size: '3' }, {}),
      createNode('print', {}, {
        values: [createNode('array_access', { name: 'arr' }, {
          index: createNode('number_literal', { value: '0' }, {})
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('0')
  })
})

// T014: 邊界情況
describe('Interpreter - edge cases', () => {
  it('should throw on undeclared variable', async () => {
    await expect(run([
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'nope' }, {})]
      })
    ])).rejects.toThrow(RuntimeError)
  })

  it('should throw on division by zero', async () => {
    await expect(run([
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '/' }, {
          left: createNode('number_literal', { value: '5' }, {}),
          right: createNode('number_literal', { value: '0' }, {}),
        })]
      })
    ])).rejects.toThrow(RuntimeError)
  })

  it('should throw on max steps exceeded', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 10 })
    await expect(
      interp.execute(makeProgram([
        createNode('while_loop', {}, {
          condition: createNode('compare', { operator: '>' }, {
            left: createNode('number_literal', { value: '1' }, {}),
            right: createNode('number_literal', { value: '0' }, {}),
          }),
          body: [
            createNode('var_declare', { name: 'x', type: 'int' }, {
              initializer: createNode('number_literal', { value: '0' }, {})
            }),
          ],
        })
      ]))
    ).rejects.toThrow(RuntimeError)
  })

  it('should skip language-specific concepts', async () => {
    const interp = await run([
      createNode('cpp:include' as any, { header: 'iostream' }, {}),
      createNode('cpp:using_namespace' as any, { namespace: 'std' }, {}),
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'ok' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('ok')
  })
})

// T026: 輸入概念
describe('Interpreter - input', () => {
  it('should read input from stdin queue', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ], ['42'])
    expect(interp.getOutput().join('')).toBe('42')
  })

  it('should convert input string to int', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: createNode('var_ref', { name: 'n' }, {}),
          right: createNode('number_literal', { value: '1' }, {}),
        })]
      })
    ], ['10'])
    expect(interp.getOutput().join('')).toBe('11')
  })

  it('should read string input', async () => {
    const interp = await run([
      createNode('var_declare', { name: 's', type: 'string' }, {
        initializer: createNode('input', { type: 'string' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 's' }, {})]
      })
    ], ['hello'])
    expect(interp.getOutput().join('')).toBe('hello')
  })

  it('should read multiple inputs sequentially', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'a', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      }),
      createNode('var_declare', { name: 'b', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: createNode('var_ref', { name: 'a' }, {}),
          right: createNode('var_ref', { name: 'b' }, {}),
        })]
      })
    ], ['3', '7'])
    expect(interp.getOutput().join('')).toBe('10')
  })

  it('should throw when input queue is exhausted', async () => {
    await expect(run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      })
    ], [])).rejects.toThrow(RuntimeError)
  })

  it('should use inputProvider when stdin is exhausted', async () => {
    const interp = new SemanticInterpreter()
    interp.setInputProvider(async () => 'world')
    await interp.execute(makeProgram([
      createNode('var_declare', { name: 's', type: 'string' }, {
        initializer: createNode('input', { type: 'string' }, {})
      }),
      createNode('print', {}, {
        values: [
          createNode('string_literal', { value: 'hello, ' }, {}),
          createNode('var_ref', { name: 's' }, {}),
        ]
      })
    ]))
    expect(interp.getOutput().join('')).toBe('hello, world')
  })
})
