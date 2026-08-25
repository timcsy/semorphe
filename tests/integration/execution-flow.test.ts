import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { RuntimeError } from '../../src/interpreter/errors'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

registerCppLanguage()

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('cpp:program', {}, { body })
}

describe('Execution flow integration', () => {
  it('should execute a simple print program', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('cpp:print', {}, {
        values: [createNode('cpp:literal_string', { value: 'Hello, World!' }, {})]
      })
    ]))
    expect(interp.getOutput().join('')).toBe('Hello, World!')
  })

  it('should execute variable declaration and print', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('cpp:var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '42' }, {})]
      }),
      createNode('cpp:print', {}, {
        values: [createNode('cpp:var_ref', { name: 'x' }, {})]
      })
    ]))
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('should provide step records via executeWithSteps', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    const steps = await interp.executeWithSteps(makeProgram([
      createNode('cpp:var_declare', { name: 'x', type: 'int' }, {
        initializer: [createNode('cpp:literal_number', { value: '10' }, {})]
      }),
      createNode('cpp:var_assign', {}, {
        // 🟢 左值是接點（2026-08-25）——在此之前是 `obj: 'x'`
        target: [createNode('cpp:var_ref', { name: 'x' })],
        value: [createNode('cpp:literal_number', { value: '20' }, {})]
      }),
    ]))
    expect(steps.length).toBeGreaterThan(0)
  })

  it('should throw on max steps exceeded', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 50 })
    await expect(
      interp.execute(makeProgram([
        createNode('cpp:loop_while', {}, {
          condition: [createNode('cpp:compare', { operator: '>' }, {
            left: [createNode('cpp:literal_number', { value: '1' }, {})],
            right: [createNode('cpp:literal_number', { value: '0' }, {})],
          })],
          body: [
            createNode('cpp:var_declare', { name: 'x', type: 'int' }, {
              initializer: [createNode('cpp:literal_number', { value: '0' }, {})]
            }),
          ],
        })
      ]))
    ).rejects.toThrow(RuntimeError)
  })

  it('should handle stdin input', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 1000 })
    await interp.execute(makeProgram([
      createNode('cpp:var_declare', { name: 'n', type: 'int' }, {
        initializer: [createNode('cpp:input', { type: 'int' }, {})]
      }),
      createNode('cpp:print', {}, {
        values: [createNode('cpp:var_ref', { name: 'n' }, {})]
      })
    ]), ['7'])
    expect(interp.getOutput().join('')).toContain('7')
  })
})
