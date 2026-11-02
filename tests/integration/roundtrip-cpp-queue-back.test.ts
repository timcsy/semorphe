/**
 * cpp_queue_back round-trip and execution tests.
 *
 * Lift limitation note: q.back() code→blocks path lifts to cpp_vector_back
 * (shared method name). These tests verify:
 *   1. generate: SemanticNode → ".back()" code (block→code direction)
 *   2. execute: Cella returns the tail element (spec 202：判準從 JS 直譯器換成 Cella——
 *      積木的語義樹先產成程式碼、包成完整程式，再走 lift → formalize → Cella)
 *
 * The lift (code→blocks) direction is intentionally not tested here because
 * back() is shared with vector and the lifter maps it to cpp_vector_back.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createNode } from '../../src/core/semantic-tree'
import { runCella, expectCellaOut, type CellaRunResult } from '../helpers/cella-run'
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
  return createNode('cpp:program', {}, { body })
}

function num(v: number): SemanticNode {
  return createNode('cpp:literal_number', { value: String(v) }, {})
}

/** 語義樹 → 產生的程式碼 → 包成完整程式（產生器只產 main 的本體） */
function programOf(body: SemanticNode[]): string {
  const inner = generateCode(makeProgram(body), 'cpp', style)
  return `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n${inner}\n    return 0;\n}\n`
}

const runCellaTree = (body: SemanticNode[]): Promise<CellaRunResult> => runCella(programOf(body))
const expectTreeOut = (body: SemanticNode[], expected: string): Promise<CellaRunResult> =>
  expectCellaOut(programOf(body), expected)

// ─── Generate tests (block→code) ──────────────────────────────────────────────

describe('cpp_queue_back — generate (block→code)', () => {
  it('should generate q.back()', () => {
    const node = createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })
    const program = makeProgram([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:var_assign', {}, {
        // 🟢 左值是接點（2026-08-25）——在此之前是 `obj: 'x'`
        target: [createNode('cpp:var_ref', { name: 'x' })], value: [node] }),
    ])
    const code = generateCode(program, 'cpp', style)
    expect(code).toContain('.back()')
  })

  it('should use the obj property as the variable name', () => {
    const node = createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'myQueue' })], })
    const program = makeProgram([node])
    const code = generateCode(program, 'cpp', style)
    expect(code).toContain('myQueue.back()')
  })
})

// ─── Execute tests (Cella) ───────────────────────────────────────────────

describe('cpp_queue_back — execute (Cella)', () => {
  it('back() returns the last pushed element', async () => {
    await expectTreeOut([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(10)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(20)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(30)] }),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
    ], '30')
  })

  it('back() is independent of front() — they refer to opposite ends', async () => {
    await expectTreeOut([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(1)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(2)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(3)] }),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_front', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
    ], '1')
    await expectTreeOut([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(1)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(2)] }),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(3)] }),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
    ], '3')
  })

  // 🔴 期望值改了（spec 202）：原本斷言「印出預設值 0、不丟錯」，那是 JS 直譯器自己的取捨。
  // C++ 標準：`queue::back()` 轉呼叫 `deque::back()`，空容器上呼叫是未定義行為（[sequence.reqmts]：
  // `a.back()` 的前置條件是 `a.empty() == false`）⟹ 判 reject，種類是越界。
  it('back() on empty queue is undefined behaviour → Cella rejects (out of bounds)', async () => {
    const r = await runCellaTree([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
    ])
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubBounds')
    expect(r.problems.find((p) => p.kind === 'ubBounds')?.source?.text).toBe('q.back()')
  })

  it('back() does not remove the element', async () => {
    await expectTreeOut([
      createNode('cpp:queue_declare', { name: 'q', type: 'int' }, {}),
      createNode('cpp:container_push', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })],  value: [num(42)] }),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
      createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'q' })], })] }),
    ], '4242')
  })
})
