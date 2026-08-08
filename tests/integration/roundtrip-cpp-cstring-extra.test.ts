/**
 * Roundtrip tests for C++ <cstring> concepts not covered by fuzz tests
 *
 * Covers: cpp_strcat, cpp_strncmp, cpp_strncpy, cpp_memcpy, cpp_memset
 * These concepts have generators and blocks but were missing dedicated roundtrip tests.
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

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function findConcept(node: SemanticNode | null, conceptId: string): SemanticNode | null {
  if (!node) return null
  if (node.conceptId === conceptId) return node
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      const found = findConcept(child, conceptId)
      if (found) return found
    }
  }
  return null
}

describe('C++ <cstring> extra roundtrip', () => {
  // ─── cpp_strcat ────────────────────────────────────────
  describe('cpp:strcat', () => {
    it('should lift strcat(dest, src) to cpp_strcat concept', () => {
      const tree = liftCode('strcat(dest, src);')
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp:strcat')
      expect(node).not.toBeNull()
    })

    it('should generate strcat(dest, src) from SemanticNode', () => {
      const dest = createNode('lang:var_ref', { name: 'buf' })
      const src = createNode('lang:var_ref', { name: 'suffix' })
      const strcat = createNode('cpp:strcat', {}, {
        dest: [dest],
        src: [src],
      })
      const prog = createNode('lang:program', {}, { body: [strcat] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('strcat(buf, suffix)')
    })
  })

  // ─── cpp_strncpy ───────────────────────────────────────
  describe('cpp:strncpy', () => {
    it('should lift strncpy(dest, src, n) to cpp_strncpy concept', () => {
      const tree = liftCode('strncpy(dest, src, 10);')
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp:strncpy')
      expect(node).not.toBeNull()
    })

    it('should generate strncpy(dest, src, n) from SemanticNode', () => {
      const dest = createNode('lang:var_ref', { name: 'buf' })
      const src = createNode('lang:var_ref', { name: 'str' })
      const n = createNode('lang:number_literal', { value: '5' })
      const strncpy = createNode('cpp:strncpy', {}, {
        dest: [dest],
        src: [src],
        n: [n],
      })
      const prog = createNode('lang:program', {}, { body: [strncpy] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('strncpy(buf, str, 5)')
    })
  })

  // ─── cpp_strncmp ───────────────────────────────────────
  describe('cpp:strncmp', () => {
    it('should lift strncmp(s1, s2, n) to cpp_strncmp concept', () => {
      const tree = liftCode('int r = strncmp(s1, s2, 3);')
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp:strncmp')
      expect(node).not.toBeNull()
    })

    it('should generate strncmp(s1, s2, n) as expression', () => {
      const s1 = createNode('lang:var_ref', { name: 'a' })
      const s2 = createNode('lang:var_ref', { name: 'b' })
      const n = createNode('lang:number_literal', { value: '4' })
      const strncmp = createNode('cpp:strncmp', {}, {
        s1: [s1],
        s2: [s2],
        n: [n],
      })
      const decl = createNode('lang:var_declare', { type: 'int', name: 'r' }, {
        initializer: [strncmp],
      })
      const prog = createNode('lang:program', {}, { body: [decl] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('strncmp(a, b, 4)')
    })
  })

  // ─── cpp_memset ────────────────────────────────────────
  describe('cpp:memset', () => {
    it('should lift memset(ptr, val, size) to cpp_memset concept', () => {
      const tree = liftCode('memset(arr, 0, 100);')
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp:memset')
      expect(node).not.toBeNull()
    })

    it('should generate memset(ptr, value, size) from SemanticNode', () => {
      const ptr = createNode('lang:var_ref', { name: 'buf' })
      const val = createNode('lang:number_literal', { value: '0' })
      const size = createNode('lang:number_literal', { value: '256' })
      const memset = createNode('cpp:memset', {}, {
        ptr: [ptr],
        value: [val],
        size: [size],
      })
      const prog = createNode('lang:program', {}, { body: [memset] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('memset(buf, 0, 256)')
    })
  })

  // ─── cpp_memcpy ────────────────────────────────────────
  describe('cpp:memcpy', () => {
    it('should lift memcpy(dest, src, size) to cpp_memcpy concept', () => {
      const tree = liftCode('memcpy(dest, src, 64);')
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp:memcpy')
      expect(node).not.toBeNull()
    })

    it('should generate memcpy(dest, src, size) from SemanticNode', () => {
      const dest = createNode('lang:var_ref', { name: 'dst' })
      const src = createNode('lang:var_ref', { name: 'src' })
      const size = createNode('lang:number_literal', { value: '32' })
      const memcpy = createNode('cpp:memcpy', {}, {
        dest: [dest],
        src: [src],
        size: [size],
      })
      const prog = createNode('lang:program', {}, { body: [memcpy] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('memcpy(dst, src, 32)')
    })
  })
})
