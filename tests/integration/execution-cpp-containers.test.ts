/**
 * Interpreter execution tests for Stack and Queue containers.
 *
 * Roundtrip tests only verify code↔semantic-tree structural equivalence.
 * These tests verify the interpreter produces correct runtime output,
 * specifically that:
 *   - Stack is LIFO: pop removes the most recently pushed element
 *   - Queue is FIFO: pop removes the earliest pushed element
 */
// ⚠️ 091：C++ 的 `cout << (x > 2)` 印出 **1／0**，不是 `true`／`false`
// （後者要 `std::boolalpha`）。這個檔原本的斷言記錄的是**舊的錯誤輸出**，
// 期望值已改為 g++ 實際印出的東西。
import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

registerCppLanguage()

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('lang:program', {}, { body })
}

function num(v: number) {
  return createNode('lang:number_literal', { value: String(v) }, {})
}

function varRef(name: string) {
  return createNode('lang:var_ref', { name }, {})
}

function printNode(expr: SemanticNode) {
  return createNode('lang:print', {}, { values: [expr] })
}

function printLine(expr: SemanticNode) {
  return createNode('lang:print', {}, {
    values: [expr, createNode('lang:string_literal', { value: '\n' }, {})],
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
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(30)] }),
      printNode(createNode('cpp:stack_top', { obj: 's' }, {})),
    ])
    expect(output).toContain('30')
  })

  it('pop() removes the top element (LIFO order)', async () => {
    const output = await run([
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(30)] }),
      createNode('cpp:container_pop', { obj: 's' }, {}),
      printNode(createNode('cpp:stack_top', { obj: 's' }, {})),
    ])
    expect(output).toContain('20')
  })

  it('empty() returns true on empty stack, false after push', async () => {
    const emptyBefore = await run([
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      printNode(createNode('cpp:container_empty', { obj: 's' }, {})),
    ])
    expect(emptyBefore).toContain('1')

    const emptyAfter = await run([
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(1)] }),
      printNode(createNode('cpp:container_empty', { obj: 's' }, {})),
    ])
    expect(emptyAfter).toContain('0')
  })

  it('drain loop prints in LIFO order (30 20 10)', async () => {
    const output = await run([
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(30)] }),
      createNode('lang:while_loop', {}, {
        condition: [createNode('lang:logic_not', {}, {
          operand: [createNode('cpp:container_empty', { obj: 's' }, {})],
        })],
        body: [
          printLine(createNode('cpp:stack_top', { obj: 's' }, {})),
          createNode('cpp:container_pop', { obj: 's' }, {}),
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
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(30)] }),
      printNode(createNode('cpp:queue_front', { obj: 'q' }, {})),
    ])
    expect(output).toContain('10')
  })

  it('pop() removes the front element (FIFO order)', async () => {
    const output = await run([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(30)] }),
      createNode('cpp:container_pop', { obj: 'q' }, {}),
      printNode(createNode('cpp:queue_front', { obj: 'q' }, {})),
    ])
    expect(output).toContain('20')
  })

  it('empty() returns true on empty queue, false after push', async () => {
    const emptyBefore = await run([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      printNode(createNode('cpp:container_empty', { obj: 'q' }, {})),
    ])
    expect(emptyBefore).toContain('1')

    const emptyAfter = await run([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(1)] }),
      printNode(createNode('cpp:container_empty', { obj: 'q' }, {})),
    ])
    expect(emptyAfter).toContain('0')
  })

  it('drain loop prints in FIFO order (10 20 30)', async () => {
    const output = await run([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(30)] }),
      createNode('lang:while_loop', {}, {
        condition: [createNode('lang:logic_not', {}, {
          operand: [createNode('cpp:container_empty', { obj: 'q' }, {})],
        })],
        body: [
          printLine(createNode('cpp:queue_front', { obj: 'q' }, {})),
          createNode('cpp:container_pop', { obj: 'q' }, {}),
        ],
      }),
    ])
    const lines = output.trim().split('\n')
    expect(lines).toEqual(['10', '20', '30'])
  })

  it('queue and stack with same values produce opposite drain orders', async () => {
    const stackOutput = await run([
      createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(1)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(2)] }),
      createNode('cpp:container_push', { obj: 's' }, { value: [num(3)] }),
      createNode('lang:while_loop', {}, {
        condition: [createNode('lang:logic_not', {}, {
          operand: [createNode('cpp:container_empty', { obj: 's' }, {})],
        })],
        body: [
          printLine(createNode('cpp:stack_top', { obj: 's' }, {})),
          createNode('cpp:container_pop', { obj: 's' }, {}),
        ],
      }),
    ])

    const queueOutput = await run([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(1)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(2)] }),
      createNode('cpp:container_push', { obj: 'q' }, { value: [num(3)] }),
      createNode('lang:while_loop', {}, {
        condition: [createNode('lang:logic_not', {}, {
          operand: [createNode('cpp:container_empty', { obj: 'q' }, {})],
        })],
        body: [
          printLine(createNode('cpp:queue_front', { obj: 'q' }, {})),
          createNode('cpp:container_pop', { obj: 'q' }, {}),
        ],
      }),
    ])

    expect(stackOutput.trim().split('\n')).toEqual(['3', '2', '1'])
    expect(queueOutput.trim().split('\n')).toEqual(['1', '2', '3'])
  })
})
