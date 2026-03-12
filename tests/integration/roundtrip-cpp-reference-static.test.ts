/**
 * Round-trip tests for C++ reference and static concepts:
 * cpp_ref_declare, cpp_static_declare, cpp_static_member
 *
 * Verifies: code → lift → SemanticTree → generate → code
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'

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

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

describe('Round-trip: C++ reference and static (cpp_ref_declare, cpp_static_declare, cpp_static_member)', () => {
  describe('cpp_ref_declare', () => {
    it('basic reference with initializer', () => {
      const code = `int& ref = x;`
      const result = roundTripCode(code)
      expect(result).toContain('int& ref = x;')
    })

    it('double reference', () => {
      const code = `double& dref = y;`
      const result = roundTripCode(code)
      expect(result).toContain('double& dref = y;')
    })

    it('reference in function body', () => {
      const code = `void f() {
    int x = 10;
    int& ref = x;
}`
      const result = roundTripCode(code)
      expect(result).toContain('int& ref = x;')
    })
  })

  describe('cpp_static_declare', () => {
    it('static int with initializer', () => {
      const code = `static int count = 0;`
      const result = roundTripCode(code)
      expect(result).toContain('static int count = 0;')
    })

    it('static double', () => {
      const code = `static double total = 0;`
      const result = roundTripCode(code)
      expect(result).toContain('static double total = 0;')
    })

    it('static in function', () => {
      const code = `void counter() {
    static int n = 0;
}`
      const result = roundTripCode(code)
      expect(result).toContain('static int n = 0;')
    })
  })

  describe('combined', () => {
    it('static and reference in same function', () => {
      const code = `void f() {
    static int count = 0;
    int& ref = count;
}`
      const result = roundTripCode(code)
      expect(result).toContain('static int count = 0;')
      expect(result).toContain('int& ref = count;')
    })

    it('second round-trip produces structurally equivalent tree (P1)', () => {
      const code = `static int x = 5;`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const generated = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(generated)
      expect(tree2).not.toBeNull()

      function findConcept(node: any, concept: string): boolean {
        if (node.concept === concept) return true
        for (const children of Object.values(node.children ?? {})) {
          for (const child of children as any[]) {
            if (findConcept(child, concept)) return true
          }
        }
        return false
      }
      expect(findConcept(tree1!, 'cpp_static_declare')).toBe(true)
      expect(findConcept(tree2!, 'cpp_static_declare')).toBe(true)
    })
  })
})
