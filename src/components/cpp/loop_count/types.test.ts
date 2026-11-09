/**
 * 計數迴圈那顆只收 `int` 的迴圈變數（2026-11-09）：它沒有型別這一格、產碼一律寫 `int`——
 * `for (long long i = …)` 原本被它接走，走一趟就變成 `for (int i = …)`（靜默改寫；值超過 int 時結果不同）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const round = (body: string): { code: string; ids: string[] } => {
  const src = `int main() {\n${body}    return 0;\n}\n`
  const t = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  const main = t.slots.body.find((n) => n.componentId === 'cpp:func_def')!
  return { code: generateCode(t, 'cpp', apcs as unknown as StylePreset), ids: main.slots.body.map((n) => n.componentId) }
}

describe('計數 for 的迴圈變數型別', () => {
  it('int → 計數迴圈那顆', () => {
    const r = round('    for (int i = 0; i < 3; i++) {\n    }\n')
    expect(r.ids[0]).toBe('cpp:loop_count')
    expect(r.code).toContain('for (int i = 0; i < 3; i++) {')
  })
  it.each(['long long', 'unsigned', 'size_t', 'short'])('%s → 一般的 for，型別一字不差', (ty) => {
    const r = round(`    for (${ty} i = 0; i < 3; i++) {\n    }\n`)
    expect(r.ids[0]).not.toBe('cpp:loop_count')
    expect(r.code).toContain(`for (${ty} i = 0; i < 3; i++) {`)
  })
})
