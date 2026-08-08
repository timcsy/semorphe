import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { RuntimeError } from '../../src/interpreter/errors'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

registerCppLanguage()

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('lang:program', {}, { body })
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
      createNode('lang:print', {}, {
        values: [createNode('lang:string_literal', { value: 'Hello World' }, {})]
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
      createNode('lang:var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('lang:number_literal', { value: '3' }, {})]
      }),
      createNode('lang:var_declare', { name: 'y', type: 'int' }, {
        initializer: [createNode('lang:number_literal', { value: '4' }, {})]
      }),
      createNode('lang:print', {}, {
        values: [createNode('lang:arithmetic', { operator: '+' }, {
          left: [createNode('lang:var_ref', { name: 'x' }, {})],
          right: [createNode('lang:var_ref', { name: 'y' }, {})],
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
      createNode('lang:var_declare', { name: 'n', type: 'int' }, {
        initializer: [createNode('lang:input', { type: 'int' }, {})]
      }),
      createNode('lang:print', {}, {
        values: [createNode('lang:arithmetic', { operator: '*' }, {
          left: [createNode('lang:var_ref', { name: 'n' }, {})],
          right: [createNode('lang:number_literal', { value: '2' }, {})],
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
      createNode('lang:count_loop', { var_name: 'i', inclusive: 'TRUE' }, {
        from: [createNode('lang:number_literal', { value: '1' }, {})],
        to: [createNode('lang:number_literal', { value: '5' }, {})],
        body: [
          createNode('lang:print', {}, {
            values: [
              createNode('lang:var_ref', { name: 'i' }, {}),
              createNode('lang:endl', {}, {}),
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
      createNode('lang:func_def', {
        name: 'factorial',
        return_type: 'int',
      }, {
        params: [createNode('param_decl', { type: 'int', name: 'n' })],
        body: [
          createNode('lang:if', {}, {
            condition: [createNode('lang:compare', { operator: '<=' }, {
              left: [createNode('lang:var_ref', { name: 'n' }, {})],
              right: [createNode('lang:number_literal', { value: '1' }, {})],
            })],
            then_body: [
              createNode('lang:return', {}, {
                value: [createNode('lang:number_literal', { value: '1' }, {})]
              })
            ],
          }),
          createNode('lang:return', {}, {
            value: [createNode('lang:arithmetic', { operator: '*' }, {
              left: [createNode('lang:var_ref', { name: 'n' }, {})],
              right: [createNode('lang:func_call', { name: 'factorial' }, {
                args: [createNode('lang:arithmetic', { operator: '-' }, {
                  left: [createNode('lang:var_ref', { name: 'n' }, {})],
                  right: [createNode('lang:number_literal', { value: '1' }, {})],
                })]
              })],
            })]
          }),
        ]
      }),
      createNode('lang:print', {}, {
        values: [createNode('lang:func_call', { name: 'factorial' }, {
          args: [createNode('lang:number_literal', { value: '5' }, {})]
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
      createNode('lang:var_declare', { name: 'a', type: 'int' }, {
        initializer: [createNode('lang:number_literal', { value: '1' }, {})]
      }),
      createNode('lang:var_declare', { name: 'b', type: 'int' }, {
        initializer: [createNode('lang:number_literal', { value: '2' }, {})]
      }),
      createNode('lang:var_declare', { name: 'c', type: 'int' }, {
        initializer: [createNode('lang:arithmetic', { operator: '+' }, {
          left: [createNode('lang:var_ref', { name: 'a' }, {})],
          right: [createNode('lang:var_ref', { name: 'b' }, {})],
        })]
      }),
      createNode('lang:print', {}, {
        values: [createNode('lang:var_ref', { name: 'c' }, {})]
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
        createNode('lang:while_loop', {}, {
          condition: [createNode('lang:compare', { operator: '>' }, {
            left: [createNode('lang:number_literal', { value: '1' }, {})],
            right: [createNode('lang:number_literal', { value: '0' }, {})],
          })],
          body: [
            createNode('lang:var_declare', { name: 'x', type: 'int' }, {
              initializer: [createNode('lang:number_literal', { value: '0' }, {})]
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
      createNode('lang:print', {}, {
        values: [createNode('lang:var_ref', { name: 'x' }, {})]
      })
    ])).rejects.toThrow(RuntimeError)
  })
})
