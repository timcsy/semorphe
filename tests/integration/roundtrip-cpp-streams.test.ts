/**
 * Roundtrip tests for C++ stream declaration concepts
 *
 * Covers: cpp_ifstream_declare, cpp_ofstream_declare, cpp_stringstream_declare
 * These are Blockly-only concepts (no source-code lifter) — tests verify generator output.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'
import type { SemanticNode } from '../../src/core/semantic-tree'
import { createNode } from '../../src/core/semantic-tree'

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

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

describe('C++ stream declarations', () => {
  // ─── cpp_ifstream_declare ──────────────────────────────
  describe('cpp:ifstream_declare', () => {
    it('should generate ifstream declaration with name and file', () => {
      const node = createNode('cpp:ifstream_declare', { name: 'fin', file: 'input.txt' })
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('ifstream fin("input.txt")')
    })

    it('should use default values when properties missing', () => {
      const node = createNode('cpp:ifstream_declare', {})
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('ifstream fin("input.txt")')
    })
  })

  // ─── cpp_ofstream_declare ──────────────────────────────
  describe('cpp:ofstream_declare', () => {
    it('should generate ofstream declaration with name and file', () => {
      const node = createNode('cpp:ofstream_declare', { name: 'fout', file: 'output.txt' })
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('ofstream fout("output.txt")')
    })

    it('should generate with custom name and file', () => {
      const node = createNode('cpp:ofstream_declare', { name: 'out', file: 'result.txt' })
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('ofstream out("result.txt")')
    })
  })

  // ─── cpp_stringstream_declare ──────────────────────────
  describe('cpp:stringstream_declare', () => {
    it('should generate stringstream declaration with name', () => {
      const node = createNode('cpp:stringstream_declare', { name: 'ss' })
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('stringstream ss')
    })

    it('should use default name when property missing', () => {
      const node = createNode('cpp:stringstream_declare', {})
      const prog = createNode('cpp:program', {}, { body: [node] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('stringstream ss')
    })
  })
})
