/**
 * cpp_queue_back round-trip and execution tests.
 *
 * Lift limitation note: q.back() code→blocks path lifts to cpp_vector_back
 * (shared method name). These tests verify:
 *   1. generate: SemanticNode → ".back()" code (block→code direction)
 *   2. execute: interpreter returns the tail element
 *
 * The lift (code→blocks) direction is intentionally not tested here because
 * back() is shared with vector and the lifter maps it to cpp_vector_back.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createNode } from '../../src/core/semantic-tree'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { StylePreset } from '../../src/core/types'
import type { SemanticNode } from '../../src/core/semantic-tree'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

beforeAll(() => {
  registerCppLanguage()
  setupTestRenderer()
})

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

function num(v: number): SemanticNode {
  return createNode('number_literal', { value: String(v) }, {})
}

async function runInterpreter(body: SemanticNode[]): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 10000 })
  await interp.execute(makeProgram(body))
  return interp.getOutput().join('')
}

// ─── Generate tests (block→code) ──────────────────────────────────────────────

describe('cpp_queue_back — generate (block→code)', () => {
  it('should generate q.back()', () => {
    const node = createNode('cpp_queue_back', { obj: 'q' }, {})
    const program = makeProgram([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('var_assign', { name: 'x' }, { value: [node] }),
    ])
    const code = generateCode(program, 'cpp', style)
    expect(code).toContain('.back()')
  })

  it('should use the obj property as the variable name', () => {
    const node = createNode('cpp_queue_back', { obj: 'myQueue' }, {})
    const program = makeProgram([node])
    const code = generateCode(program, 'cpp', style)
    expect(code).toContain('myQueue.back()')
  })
})

// ─── Execute tests (interpreter) ───────────────────────────────────────────────

describe('cpp_queue_back — execute (interpreter)', () => {
  it('back() returns the last pushed element', async () => {
    const output = await runInterpreter([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(10)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(20)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(30)] }),
      createNode('print', {}, { values: [createNode('cpp_queue_back', { obj: 'q' }, {})] }),
    ])
    expect(output).toContain('30')
  })

  it('back() is independent of front() — they refer to opposite ends', async () => {
    const frontOutput = await runInterpreter([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(1)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(2)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(3)] }),
      createNode('print', {}, { values: [createNode('cpp_queue_front', { obj: 'q' }, {})] }),
    ])
    const backOutput = await runInterpreter([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(1)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(2)] }),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(3)] }),
      createNode('print', {}, { values: [createNode('cpp_queue_back', { obj: 'q' }, {})] }),
    ])
    expect(frontOutput).toContain('1')
    expect(backOutput).toContain('3')
  })

  it('back() on empty queue returns default value without throwing', async () => {
    const output = await runInterpreter([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('print', {}, { values: [createNode('cpp_queue_back', { obj: 'q' }, {})] }),
    ])
    expect(output).toContain('0')
  })

  it('back() does not remove the element', async () => {
    const output = await runInterpreter([
      createNode('cpp_queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp_container_push', { obj: 'q' }, { value: [num(42)] }),
      createNode('print', {}, { values: [createNode('cpp_queue_back', { obj: 'q' }, {})] }),
      createNode('print', {}, { values: [createNode('cpp_queue_back', { obj: 'q' }, {})] }),
    ])
    expect(output).toBe('4242')
  })
})
