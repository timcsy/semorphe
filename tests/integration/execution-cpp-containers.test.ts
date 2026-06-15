/**
 * Interpreter execution tests for Stack and Queue containers.
 *
 * Roundtrip tests only verify code↔semantic-tree structural equivalence.
 * These tests verify the interpreter produces correct runtime output,
 * specifically that:
 *   - Stack is LIFO: pop removes the most recently pushed element
 *   - Queue is FIFO: pop removes the earliest pushed element
 */
import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

function num(v: number) {
  return createNode('number_literal', { value: String(v) }, {})
}

function varRef(name: string) {
  return createNode('var_ref', { name }, {})
}

function printNode(expr: SemanticNode) {
  return createNode('print', {}, { values: [expr] })
}

function printLine(expr: SemanticNode) {
  return createNode('print', {}, {
    values: [expr, createNode('string_literal', { value: '\n' }, {})],
  })
}

async function run(body: SemanticNode[]): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 10000 })
  await interp.execute(makeProgram(body))
  return interp.getOutput().join('')
}

// ─── Stack (LIFO) ─────────────────────────────────────────────────────────────

describe('Stack execution (LIFO)', () => {
  it('top() returns the last pushed element', async () => {
    const output = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(30)] }),
      printNode(createNode('cpp_stack_top', { obj: 's' }, {})),
    ])
    expect(output).toContain('30')
  })

  it('pop() removes the top element (LIFO order)', async () => {
    const output = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(30)] }),
      createNode('cpp_container_pop', { obj: 's' }, {}),
      printNode(createNode('cpp_stack_top', { obj: 's' }, {})),
    ])
    expect(output).toContain('20')
  })

  it('empty() returns true on empty stack, false after push', async () => {
    const emptyBefore = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      printNode(createNode('cpp_container_empty', { obj: 's' }, {})),
    ])
    expect(emptyBefore).toContain('true')

    const emptyAfter = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(1)] }),
      printNode(createNode('cpp_container_empty', { obj: 's' }, {})),
    ])
    expect(emptyAfter).toContain('false')
  })

  it('drain loop prints in LIFO order (30 20 10)', async () => {
    const output = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(30)] }),
      createNode('while_loop', {}, {
        condition: [createNode('logic_not', {}, {
          operand: [createNode('cpp_container_empty', { obj: 's' }, {})],
        })],
        body: [
          printLine(createNode('cpp_stack_top', { obj: 's' }, {})),
          createNode('cpp_container_pop', { obj: 's' }, {}),
        ],
      }),
    ])
    const lines = output.trim().split('\n')
    expect(lines).toEqual(['30', '20', '10'])
  })
})

// ─── Queue (FIFO) ─────────────────────────────────────────────────────────────

describe('Queue execution (FIFO)', () => {
  it('front() returns the first pushed element', async () => {
    const output = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(30)] }),
      printNode(createNode('cpp_queue_front', { obj: 'q' }, {})),
    ])
    expect(output).toContain('10')
  })

  it('pop() removes the front element (FIFO order)', async () => {
    const output = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(30)] }),
      createNode('cpp_container_pop', { obj: 'q' }, {}),
      printNode(createNode('cpp_queue_front', { obj: 'q' }, {})),
    ])
    expect(output).toContain('20')
  })

  it('empty() returns true on empty queue, false after push', async () => {
    const emptyBefore = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      printNode(createNode('cpp_container_empty', { obj: 'q' }, {})),
    ])
    expect(emptyBefore).toContain('true')

    const emptyAfter = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(1)] }),
      printNode(createNode('cpp_container_empty', { obj: 'q' }, {})),
    ])
    expect(emptyAfter).toContain('false')
  })

  it('drain loop prints in FIFO order (10 20 30)', async () => {
    const output = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(30)] }),
      createNode('while_loop', {}, {
        condition: [createNode('logic_not', {}, {
          operand: [createNode('cpp_container_empty', { obj: 'q' }, {})],
        })],
        body: [
          printLine(createNode('cpp_queue_front', { obj: 'q' }, {})),
          createNode('cpp_container_pop', { obj: 'q' }, {}),
        ],
      }),
    ])
    const lines = output.trim().split('\n')
    expect(lines).toEqual(['10', '20', '30'])
  })

  it('queue and stack with same values produce opposite drain orders', async () => {
    const stackOutput = await run([
      createNode('cpp_stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(1)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(2)] }),
      createNode('cpp_container_push', { obj: 's' }, { value: [num(3)] }),
      createNode('while_loop', {}, {
        condition: [createNode('logic_not', {}, {
          operand: [createNode('cpp_container_empty', { obj: 's' }, {})],
        })],
        body: [
          printLine(createNode('cpp_stack_top', { obj: 's' }, {})),
          createNode('cpp_container_pop', { obj: 's' }, {}),
        ],
      }),
    ])

    const queueOutput = await run([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(1)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(2)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(3)] }),
      createNode('while_loop', {}, {
        condition: [createNode('logic_not', {}, {
          operand: [createNode('cpp_container_empty', { obj: 'q' }, {})],
        })],
        body: [
          printLine(createNode('cpp_queue_front', { obj: 'q' }, {})),
          createNode('cpp_container_pop', { obj: 'q' }, {}),
        ],
      }),
    ])

    expect(stackOutput.trim().split('\n')).toEqual(['3', '2', '1'])
    expect(queueOutput.trim().split('\n')).toEqual(['1', '2', '3'])
  })
})
