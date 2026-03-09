import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'
import { createNode } from '../../src/core/semantic-tree'
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
        initializer: [createNode('number_literal', { value: '5' }, {})]
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
        initializer: [createNode('number_literal', { value: '1' }, {})]
      }),
      createNode('var_assign', { name: 'x' }, {
        value: [createNode('number_literal', { value: '10' }, {})]
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
          left: [createNode('number_literal', { value: left }, {})],
          right: [createNode('number_literal', { value: right }, {})],
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
          left: [createNode('number_literal', { value: '3' }, {})],
          right: [createNode('arithmetic', { operator: '*' }, {
            left: [createNode('number_literal', { value: '4' }, {})],
            right: [createNode('number_literal', { value: '2' }, {})],
          })],
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
        initializer: [createNode('compare', { operator: op }, {
          left: [createNode('number_literal', { value: left }, {})],
          right: [createNode('number_literal', { value: right }, {})],
        })]
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
          left: [createNode('compare', { operator: '>' }, {
            left: [createNode('number_literal', { value: '5' }, {})],
            right: [createNode('number_literal', { value: '3' }, {})],
          })],
          right: [createNode('compare', { operator: '<' }, {
            left: [createNode('number_literal', { value: '5' }, {})],
            right: [createNode('number_literal', { value: '3' }, {})],
          })],
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('false')
  })

  it('should evaluate logic_not', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('logic_not', {}, {
          operand: [createNode('compare', { operator: '>' }, {
            left: [createNode('number_literal', { value: '5' }, {})],
            right: [createNode('number_literal', { value: '3' }, {})],
          })],
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
        initializer: [createNode('number_literal', { value: '5' }, {})]
      }),
      createNode('if', {}, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('var_ref', { name: 'x' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })],
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
        initializer: [createNode('number_literal', { value: '-1' }, {})]
      }),
      createNode('if', {}, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('var_ref', { name: 'x' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })],
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
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '3' }, {})],
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
        initializer: [createNode('number_literal', { value: '3' }, {})]
      }),
      createNode('while_loop', {}, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('var_ref', { name: 'n' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'n' }, {})]
          }),
          createNode('var_assign', { name: 'n' }, {
            value: [createNode('arithmetic', { operator: '-' }, {
              left: [createNode('var_ref', { name: 'n' }, {})],
              right: [createNode('number_literal', { value: '1' }, {})],
            })]
          }),
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('321')
  })

  it('should handle break in loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '10' }, {})],
        body: [
          createNode('if', {}, {
            condition: [createNode('compare', { operator: '>' }, {
              left: [createNode('var_ref', { name: 'i' }, {})],
              right: [createNode('number_literal', { value: '3' }, {})],
            })],
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
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '5' }, {})],
        body: [
          createNode('if', {}, {
            condition: [createNode('compare', { operator: '==' }, {
              left: [createNode('var_ref', { name: 'i' }, {})],
              right: [createNode('number_literal', { value: '3' }, {})],
            })],
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
            value: [createNode('arithmetic', { operator: '*' }, {
              left: [createNode('var_ref', { name: 'n' }, {})],
              right: [createNode('number_literal', { value: '2' }, {})],
            })]
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
            condition: [createNode('compare', { operator: '<=' }, {
              left: [createNode('var_ref', { name: 'n' }, {})],
              right: [createNode('number_literal', { value: '1' }, {})],
            })],
            then_body: [
              createNode('return', {}, {
                value: [createNode('number_literal', { value: '1' }, {})]
              })
            ],
          }),
          createNode('return', {}, {
            value: [createNode('arithmetic', { operator: '*' }, {
              left: [createNode('var_ref', { name: 'n' }, {})],
              right: [createNode('func_call', { name: 'fact' }, {
                args: [createNode('arithmetic', { operator: '-' }, {
                  left: [createNode('var_ref', { name: 'n' }, {})],
                  right: [createNode('number_literal', { value: '1' }, {})],
                })]
              })],
            })]
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
          index: [createNode('number_literal', { value: '0' }, {})]
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
          left: [createNode('number_literal', { value: '5' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })]
      })
    ])).rejects.toThrow(RuntimeError)
  })

  it('should throw on max steps exceeded', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 10 })
    await expect(
      interp.execute(makeProgram([
        createNode('while_loop', {}, {
          condition: [createNode('compare', { operator: '>' }, {
            left: [createNode('number_literal', { value: '1' }, {})],
            right: [createNode('number_literal', { value: '0' }, {})],
          })],
          body: [
            createNode('var_declare', { name: 'x', type: 'int' }, {
              initializer: [createNode('number_literal', { value: '0' }, {})]
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
        initializer: [createNode('input', { type: 'int' }, {})]
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
        initializer: [createNode('input', { type: 'int' }, {})]
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: [createNode('var_ref', { name: 'n' }, {})],
          right: [createNode('number_literal', { value: '1' }, {})],
        })]
      })
    ], ['10'])
    expect(interp.getOutput().join('')).toBe('11')
  })

  it('should read string input', async () => {
    const interp = await run([
      createNode('var_declare', { name: 's', type: 'string' }, {
        initializer: [createNode('input', { type: 'string' }, {})]
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
        initializer: [createNode('input', { type: 'int' }, {})]
      }),
      createNode('var_declare', { name: 'b', type: 'int' }, {
        initializer: [createNode('input', { type: 'int' }, {})]
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: [createNode('var_ref', { name: 'a' }, {})],
          right: [createNode('var_ref', { name: 'b' }, {})],
        })]
      })
    ], ['3', '7'])
    expect(interp.getOutput().join('')).toBe('10')
  })

  it('should return EOF (0) when input queue is exhausted', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('input', { type: 'int' }, {})]
      })
    ], [])
    // EOF returns 0 (falsy, like C++ cin >> x in bool context)
    expect(interp.getScope().get('x')).toEqual({ type: 'int', value: 0 })
  })

  it('should use inputProvider when stdin is exhausted', async () => {
    const interp = new SemanticInterpreter()
    interp.setInputProvider(async () => 'world')
    await interp.execute(makeProgram([
      createNode('var_declare', { name: 's', type: 'string' }, {
        initializer: [createNode('input', { type: 'string' }, {})]
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

// cpp_for_loop (三段式 for 迴圈)
describe('Interpreter - cpp_for_loop', () => {
  it('should execute basic three-part for loop', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' }, {})]
      }),
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_assign', { name: 'i' }, {
          value: [createNode('number_literal', { value: '0' }, {})]
        })],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' }, {})],
          right: [createNode('number_literal', { value: '3' }, {})],
        })],
        update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' }, {})],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('012')
  })

  it('should handle break in three-part for loop', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' }, {})]
      }),
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_assign', { name: 'i' }, {
          value: [createNode('number_literal', { value: '0' }, {})]
        })],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' }, {})],
          right: [createNode('number_literal', { value: '10' }, {})],
        })],
        update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' }, {})],
        body: [
          createNode('if', {}, {
            condition: [createNode('compare', { operator: '==' }, {
              left: [createNode('var_ref', { name: 'i' }, {})],
              right: [createNode('number_literal', { value: '3' }, {})],
            })],
            then_body: [createNode('break', {}, {})],
          }),
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('012')
  })

  it('should handle continue in three-part for loop', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' }, {})]
      }),
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_assign', { name: 'i' }, {
          value: [createNode('number_literal', { value: '0' }, {})]
        })],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' }, {})],
          right: [createNode('number_literal', { value: '5' }, {})],
        })],
        update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' }, {})],
        body: [
          createNode('if', {}, {
            condition: [createNode('compare', { operator: '==' }, {
              left: [createNode('var_ref', { name: 'i' }, {})],
              right: [createNode('number_literal', { value: '2' }, {})],
            })],
            then_body: [createNode('continue', {}, {})],
          }),
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('0134')
  })

  it('should handle empty body for loop', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' }, {})]
      }),
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_assign', { name: 'i' }, {
          value: [createNode('number_literal', { value: '0' }, {})]
        })],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' }, {})],
          right: [createNode('number_literal', { value: '3' }, {})],
        })],
        update: [createNode('cpp_increment', { name: 'i', operator: '++', position: 'postfix' }, {})],
        body: [],
      })
    ])
    expect(interp.getOutput()).toEqual([])
    expect(interp.getState().status).toBe('completed')
  })
})

// count_loop inclusive vs exclusive
describe('Interpreter - count_loop inclusive/exclusive', () => {
  it('should execute exclusive count_loop (default)', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '3' }, {})],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('12')
  })

  it('should execute exclusive count_loop (explicit FALSE)', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i', inclusive: 'FALSE' }, {
        from: [createNode('number_literal', { value: '0' }, {})],
        to: [createNode('number_literal', { value: '5' }, {})],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('01234')
  })
})

// 巢狀迴圈 + break/continue
describe('Interpreter - nested loops', () => {
  it('should break only inner loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '3' }, {})],
        body: [
          createNode('count_loop', { var_name: 'j', inclusive: 'TRUE' }, {
            from: [createNode('number_literal', { value: '1' }, {})],
            to: [createNode('number_literal', { value: '3' }, {})],
            body: [
              createNode('if', {}, {
                condition: [createNode('compare', { operator: '==' }, {
                  left: [createNode('var_ref', { name: 'j' }, {})],
                  right: [createNode('number_literal', { value: '2' }, {})],
                })],
                then_body: [createNode('break', {}, {})],
              }),
              createNode('print', {}, {
                values: [createNode('var_ref', { name: 'j' }, {})]
              })
            ],
          })
        ],
      })
    ])
    // Each outer iteration: inner prints only j=1 then breaks
    expect(interp.getOutput().join('')).toBe('111')
  })

  it('should continue only inner loop', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '2' }, {})],
        body: [
          createNode('count_loop', { var_name: 'j', inclusive: 'TRUE' }, {
            from: [createNode('number_literal', { value: '1' }, {})],
            to: [createNode('number_literal', { value: '3' }, {})],
            body: [
              createNode('if', {}, {
                condition: [createNode('compare', { operator: '==' }, {
                  left: [createNode('var_ref', { name: 'j' }, {})],
                  right: [createNode('number_literal', { value: '2' }, {})],
                })],
                then_body: [createNode('continue', {}, {})],
              }),
              createNode('print', {}, {
                values: [createNode('var_ref', { name: 'j' }, {})]
              })
            ],
          })
        ],
      })
    ])
    // Each outer iteration: inner prints j=1, skip j=2, print j=3
    expect(interp.getOutput().join('')).toBe('1313')
  })
})

// 字串跳脫序列 (unescapeC)
describe('Interpreter - string escape sequences', () => {
  it('should unescape \\n in string literal', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'a\\nb' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('a\nb')
  })

  it('should unescape \\t in string literal', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'a\\tb' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('a\tb')
  })

  it('should unescape \\\\ in string literal', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'a\\\\b' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('a\\b')
  })

  it('should unescape \\0 in string literal', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'a\\0b' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('a\0b')
  })
})

// 變數範圍與遮蔽
describe('Interpreter - scope and shadowing', () => {
  it('should isolate loop variable from outer scope', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '99' }, {})]
      }),
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '2' }, {})],
        body: [],
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'i' }, {})]
      })
    ])
    // After loop, outer i should still be 99
    expect(interp.getOutput().join('')).toBe('99')
  })

  it('should allow reusing loop variable in sequential loops', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '1' }, {})],
        to: [createNode('number_literal', { value: '2' }, {})],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      }),
      createNode('count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('number_literal', { value: '3' }, {})],
        to: [createNode('number_literal', { value: '4' }, {})],
        body: [
          createNode('print', {}, {
            values: [createNode('var_ref', { name: 'i' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('1234')
  })
})

// 更多邊界情況
describe('Interpreter - more edge cases', () => {
  it('should throw on modulo by zero', async () => {
    await expect(run([
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '%' }, {
          left: [createNode('number_literal', { value: '5' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })]
      })
    ])).rejects.toThrow(RuntimeError)
  })

  it('should handle if without else (false condition)', async () => {
    const interp = await run([
      createNode('if', {}, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('number_literal', { value: '1' }, {})],
          right: [createNode('number_literal', { value: '5' }, {})],
        })],
        then_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'nope' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput()).toEqual([])
  })

  it('should handle empty while loop body', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' }, {})]
      }),
      createNode('while_loop', {}, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('var_ref', { name: 'x' }, {})],
          right: [createNode('number_literal', { value: '0' }, {})],
        })],
        body: [],
      }),
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'done' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('done')
  })

  it('should handle return inside if inside function', async () => {
    const interp = await run([
      createNode('func_def', {
        name: 'abs_val',
        return_type: 'int',
        params: JSON.stringify([{ type: 'int', name: 'x' }])
      }, {
        body: [
          createNode('if', {}, {
            condition: [createNode('compare', { operator: '<' }, {
              left: [createNode('var_ref', { name: 'x' }, {})],
              right: [createNode('number_literal', { value: '0' }, {})],
            })],
            then_body: [
              createNode('return', {}, {
                value: [createNode('negate', {}, {
                  value: [createNode('var_ref', { name: 'x' }, {})]
                })]
              })
            ],
          }),
          createNode('return', {}, {
            value: [createNode('var_ref', { name: 'x' }, {})]
          })
        ]
      }),
      createNode('print', {}, {
        values: [createNode('func_call', { name: 'abs_val' }, {
          args: [createNode('negate', {}, { value: [createNode('number_literal', { value: '7' }, {})] })]
        })]
      }),
    ])
    expect(interp.getOutput().join('')).toBe('7')
  })

  it('should handle multi-variable input with children.values', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'a', type: 'int' }, {}),
      createNode('var_declare', { name: 'b', type: 'int' }, {}),
      createNode('input', {}, {
        values: [
          createNode('var_ref', { name: 'a' }, {}),
          createNode('var_ref', { name: 'b' }, {}),
        ]
      }),
      createNode('print', {}, {
        values: [
          createNode('var_ref', { name: 'a' }, {}),
          createNode('string_literal', { value: ' ' }, {}),
          createNode('var_ref', { name: 'b' }, {}),
        ]
      })
    ], ['10', '20'])
    expect(interp.getOutput().join('')).toBe('10 20')
  })

  it('should handle boolean-like logic with numbers', async () => {
    const interp = await run([
      createNode('if', {}, {
        condition: [createNode('number_literal', { value: '0' }, {})],
        then_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'yes' }, {})]
          })
        ],
        else_body: [
          createNode('print', {}, {
            values: [createNode('string_literal', { value: 'no' }, {})]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('no')
  })

  it('should handle compound assignment operators', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '10' }, {})]
      }),
      createNode('compound_assign', { name: 'x', operator: '+=' }, {
        value: [createNode('number_literal', { value: '5' }, {})]
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('15')
  })

  it('should handle cpp_increment', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '5' }, {})]
      }),
      createNode('cpp_increment', { name: 'n', operator: '++', position: 'postfix' }, {}),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'n' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('6')
  })

  it('should handle negate expression', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('negate', {}, {
          value: [createNode('number_literal', { value: '42' }, {})]
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('-42')
  })
})

describe('Interpreter - expression concepts in for-loop', () => {
  it('should handle var_declare_expr in for-loop init', async () => {
    // for (int i = 0; i < 3; i++) { print i }
    const interp = await run([
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_declare_expr', { type: 'int', name: 'i' }, {
          initializer: [createNode('number_literal', { value: '0' })],
        })],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' })],
          right: [createNode('number_literal', { value: '3' })],
        })],
        update: [createNode('cpp_increment_expr', { name: 'i', operator: '++', position: 'postfix' })],
        body: [createNode('print', {}, {
          values: [createNode('var_ref', { name: 'i' })],
        })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('012')
  })

  it('should handle cpp_increment_expr in for-loop update', async () => {
    // var i = 0; for(;;i++) { if i>=3 break; } print i → 3
    const interp = await run([
      createNode('var_declare', { name: 'i', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' })],
      }),
      createNode('cpp_for_loop', {}, {
        init: [],
        cond: [createNode('compare', { operator: '<' }, {
          left: [createNode('var_ref', { name: 'i' })],
          right: [createNode('number_literal', { value: '3' })],
        })],
        update: [createNode('cpp_increment_expr', { name: 'i', operator: '++', position: 'postfix' })],
        body: [],
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'i' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('3')
  })

  it('should handle cpp_compound_assign_expr in for-loop update', async () => {
    // for (int j = 0; j < 10; j += 3) { } print j → not accessible (scope)
    // Simpler: var s = 0; for(int i=1; i<=3; i++) { s += i } print s → 6
    const interp = await run([
      createNode('var_declare', { name: 's', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' })],
      }),
      createNode('cpp_for_loop', {}, {
        init: [createNode('var_declare_expr', { type: 'int', name: 'i' }, {
          initializer: [createNode('number_literal', { value: '1' })],
        })],
        cond: [createNode('compare', { operator: '<=' }, {
          left: [createNode('var_ref', { name: 'i' })],
          right: [createNode('number_literal', { value: '3' })],
        })],
        update: [createNode('cpp_increment_expr', { name: 'i', operator: '++', position: 'postfix' })],
        body: [createNode('cpp_compound_assign_expr', { name: 's', operator: '+=' }, {
          value: [createNode('var_ref', { name: 'i' })],
        })],
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 's' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('6')
  })

  it('should handle cpp_scanf_expr in while condition', async () => {
    // while (scanf("%d", &n) != EOF) { print n }
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }),
      createNode('while_loop', {}, {
        condition: [createNode('compare', { operator: '!=' }, {
          left: [createNode('cpp_scanf_expr', { format: '%d' }, {
            args: [createNode('var_ref', { name: 'n' })],
          })],
          right: [createNode('var_ref', { name: 'EOF' })],
        })],
        body: [createNode('print', {}, {
          values: [createNode('var_ref', { name: 'n' })],
        })],
      }),
    ], ['5', '10'])
    expect(interp.getOutput().join('')).toBe('510')
  })
})

describe('Interpreter - builtin_constant', () => {
  it('should evaluate true as 1', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('builtin_constant', { value: 'true' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('1')
  })

  it('should evaluate false as 0', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('builtin_constant', { value: 'false' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('0')
  })

  it('should evaluate EOF as -1', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('builtin_constant', { value: 'EOF' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('-1')
  })

  it('should evaluate NULL as 0', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('builtin_constant', { value: 'NULL' })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('0')
  })

  it('should use builtin_constant in condition (while != EOF)', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }),
      createNode('while_loop', {}, {
        condition: [createNode('compare', { operator: '!=' }, {
          left: [createNode('cpp_scanf_expr', { format: '%d' }, {
            args: [createNode('var_ref', { name: 'n' })],
          })],
          right: [createNode('builtin_constant', { value: 'EOF' })],
        })],
        body: [createNode('print', {}, {
          values: [createNode('var_ref', { name: 'n' })],
        })],
      }),
    ], ['7', '3'])
    expect(interp.getOutput().join('')).toBe('73')
  })

  it('should use true in array assignment', async () => {
    const interp = await run([
      createNode('array_declare', { name: 'flags', type: 'bool', size: '3' }),
      createNode('array_assign', { name: 'flags' }, {
        index: [createNode('number_literal', { value: '0' })],
        value: [createNode('builtin_constant', { value: 'true' })],
      }),
      createNode('print', {}, {
        values: [createNode('array_access', { name: 'flags' }, {
          index: [createNode('number_literal', { value: '0' })],
        })],
      }),
    ])
    expect(interp.getOutput().join('')).toBe('1')
  })
})

describe('Interpreter - abort', () => {
  it('should abort a running infinite loop', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 10_000_000 })
    const program = makeProgram([
      createNode('while_loop', {}, {
        condition: [createNode('builtin_constant', { value: 'true' })],
        body: [createNode('print', {}, {
          values: [createNode('string_literal', { value: 'x' })],
        })],
      }),
    ])

    // Start execution but abort after a short delay
    const execPromise = interp.execute(program)
    // Allow a few iterations
    await new Promise(r => setTimeout(r, 10))
    interp.abort()

    await expect(execPromise).rejects.toThrow('RUNTIME_ERR_ABORTED')
    expect(interp.getState().status).toBe('error')
  })

  it('should abort while waiting for input', async () => {
    const interp = new SemanticInterpreter()
    // Input provider that never resolves (simulates waiting)
    interp.setInputProvider(() => new Promise(() => { /* never resolves */ }))
    const program = makeProgram([
      createNode('var_declare', { name: 'x', type: 'int' }),
      createNode('input', {}, {
        values: [createNode('var_ref', { name: 'x' })],
      }),
    ])

    const execPromise = interp.execute(program)
    await new Promise(r => setTimeout(r, 10))
    interp.abort()

    await expect(execPromise).rejects.toThrow('RUNTIME_ERR_ABORTED')
  })

  it('should treat \\x04 (Ctrl+D) as EOF in cin input loop', async () => {
    const interp = new SemanticInterpreter()
    const inputs = ['10', '20', '\x04']
    let idx = 0
    interp.setInputProvider(() => Promise.resolve(inputs[idx++]))
    const program = makeProgram([
      createNode('var_declare', { name: 'x', type: 'int' }),
      createNode('var_declare', { name: 'sum', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '0' })],
      }),
      // while (cin >> x) { sum = sum + x; }
      createNode('while_loop', {}, {
        condition: [createNode('input', {}, {
          values: [createNode('var_ref', { name: 'x' })],
        })],
        body: [createNode('var_assign', { name: 'sum' }, {
          value: [createNode('arithmetic', { operator: '+' }, {
            left: [createNode('var_ref', { name: 'sum' })],
            right: [createNode('var_ref', { name: 'x' })],
          })],
        })],
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'sum' })],
      }),
    ])
    await interp.execute(program)
    expect(interp.getOutput().join('')).toBe('30')
  })

  it('should treat \\x04 as EOF in scanf', async () => {
    const interp = new SemanticInterpreter()
    const inputs = ['5', '\x04']
    let idx = 0
    interp.setInputProvider(() => Promise.resolve(inputs[idx++]))
    const program = makeProgram([
      createNode('var_declare', { name: 'n', type: 'int' }),
      // while (scanf("%d", &n) != EOF) { print n; }
      createNode('while_loop', {}, {
        condition: [createNode('compare', { operator: '!=' }, {
          left: [createNode('cpp_scanf_expr', { format: '%d' }, {
            args: [createNode('var_ref', { name: 'n' })],
          })],
          right: [createNode('builtin_constant', { value: 'EOF' })],
        })],
        body: [createNode('print', {}, {
          values: [createNode('var_ref', { name: 'n' })],
        })],
      }),
    ])
    await interp.execute(program)
    expect(interp.getOutput().join('')).toBe('5')
  })
})
