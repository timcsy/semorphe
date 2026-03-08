import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { RuntimeError } from '../../src/interpreter/errors'

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

describe('Execution flow integration', () => {
  it('should execute a simple print program', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('print', {}, {
        values: [createNode('string_literal', { value: 'Hello, World!' }, {})]
      })
    ]))
    expect(interp.getOutput().join('')).toBe('Hello, World!')
  })

  it('should execute variable declaration and print', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '42' }, {})]
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'x' }, {})]
      })
    ]))
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('should provide step records via executeWithSteps', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    const steps = await interp.executeWithSteps(makeProgram([
      createNode('var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('number_literal', { value: '10' }, {})]
      }),
      createNode('var_assign', { name: 'x' }, {
        value: [createNode('number_literal', { value: '20' }, {})]
      }),
    ]))
    expect(steps.length).toBeGreaterThan(0)
  })

  it('should throw on max steps exceeded', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 50 })
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

  it('should handle stdin input', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('var_declare', { name: 'n', type: 'int' }, {
        initializer: [createNode('input', { type: 'int' }, {})]
      }),
      createNode('print', {}, {
        values: [createNode('var_ref', { name: 'n' }, {})]
      })
    ]), ['7'])
    expect(interp.getOutput().join('')).toContain('7')
  })
})
