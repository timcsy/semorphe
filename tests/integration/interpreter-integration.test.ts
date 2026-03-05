import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-model'
import type { SemanticNode } from '../../src/core/semantic-model'
import { RuntimeError } from '../../src/interpreter/errors'

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

async function run(body: SemanticNode[], stdin: string[] = []) {
  const interp = new SemanticInterpreter()
  await interp.execute(makeProgram(body), stdin)
  return interp
}

// Quickstart 場景 1: Hello World
describe('Integration - Scenario 1: Hello World', () => {
  it('should print Hello World', async () => {
    const interp = await run([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'Hello World' }, {})]
      })
    ])
    expect(interp.getOutput().join('')).toBe('Hello World')
    expect(interp.getState().status).toBe('completed')
  })
})

// Quickstart 場景 2: 變數 + 算術 + 輸出
describe('Integration - Scenario 2: Variable + Arithmetic', () => {
  it('should compute x + y = 7', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: createNode('number_literal', { value: '3' }, {})
      }),
      createNode('var_declare', { name: 'y', type: 'int' }, {
        initializer: createNode('number_literal', { value: '4' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '+' }, {
          left: createNode('var_ref', { name: 'x' }, {}),
          right: createNode('var_ref', { name: 'y' }, {}),
        })]
      })
    ])
    expect(interp.getOutput().join('')).toBe('7')
  })
})

// Quickstart 場景 3: Input 讀取
describe('Integration - Scenario 3: Input Read', () => {
  it('should read input and compute n * 2 = 10', async () => {
    const interp = await run([
      createNode('var_declare', { name: 'n', type: 'int' }, {
        initializer: createNode('input', { type: 'int' }, {})
      }),
      createNode('print', {}, {
        values: [createNode('arithmetic', { operator: '*' }, {
          left: createNode('var_ref', { name: 'n' }, {}),
          right: createNode('number_literal', { value: '2' }, {}),
        })]
      })
    ], ['5'])
    expect(interp.getOutput().join('')).toBe('10')
  })
})

// Quickstart 場景 4: 迴圈
describe('Integration - Scenario 4: Loop', () => {
  it('should print 1 to 5 with newlines', async () => {
    const interp = await run([
      createNode('count_loop', { var_name: 'i' }, {
        from: createNode('number_literal', { value: '1' }, {}),
        to: createNode('number_literal', { value: '5' }, {}),
        body: [
          createNode('print', {}, {
            values: [
              createNode('var_ref', { name: 'i' }, {}),
              createNode('endl', {}, {}),
            ]
          })
        ],
      })
    ])
    expect(interp.getOutput().join('')).toBe('1\n2\n3\n4\n5\n')
  })
})

// Quickstart 場景 5: 遞迴函式
describe('Integration - Scenario 5: Recursive Function', () => {
  it('should compute factorial(5) = 120', async () => {
    const interp = await run([
      createNode('func_def', {
        name: 'factorial',
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
              right: createNode('func_call', { name: 'factorial' }, {
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
        values: [createNode('func_call', { name: 'factorial' }, {
          args: [createNode('number_literal', { value: '5' }, {})]
        })]
      }),
    ])
    expect(interp.getOutput().join('')).toBe('120')
  })
})

// Quickstart 場景 6: 逐步執行 (record steps)
describe('Integration - Scenario 6: Step Execution', () => {
  it('should record 4 steps for a simple program', async () => {
    const interp = new SemanticInterpreter()
    const program = makeProgram([
      createNode('var_declare', { name: 'a', type: 'int' }, {
        initializer: createNode('number_literal', { value: '1' }, {})
      }),
      createNode('var_declare', { name: 'b', type: 'int' }, {
        initializer: createNode('number_literal', { value: '2' }, {})
      }),
      createNode('var_declare', { name: 'c', type: 'int' }, {
        initializer: createNode('arithmetic', { operator: '+' }, {
          left: createNode('var_ref', { name: 'a' }, {}),
          right: createNode('var_ref', { name: 'b' }, {}),
        })
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'c' }, {})]
      })
    ])
    const steps = await interp.executeWithSteps(program)
    expect(steps.length).toBe(4)
    expect(interp.getOutput().join('')).toBe('3')
  })
})

// Quickstart 場景 7: 無窮迴圈保護
describe('Integration - Scenario 7: Infinite Loop Protection', () => {
  it('should throw after max steps', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
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
})

// Quickstart 場景 8: 執行期錯誤
describe('Integration - Scenario 8: Runtime Error', () => {
  it('should throw on undeclared variable', async () => {
    await expect(run([
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ])).rejects.toThrow(RuntimeError)
  })
})
