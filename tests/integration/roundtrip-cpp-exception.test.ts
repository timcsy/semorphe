/**
 * Round-trip tests for C++ exception handling concepts:
 * cpp_try_catch, cpp_throw
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

describe('Round-trip: C++ exception handling (cpp_try_catch, cpp_throw)', () => {
  describe('cpp_try_catch', () => {
    it('basic try-catch with empty bodies', () => {
      const code = `try {
    int x = 10;
} catch (exception& e) {
    int y = 0;
}`
      const result = roundTripCode(code)
      expect(result).toContain('try {')
      expect(result).toContain('catch (exception& e)')
      expect(result).toContain('int x = 10;')
      expect(result).toContain('int y = 0;')
    })

    it('try-catch with print statements', () => {
      const code = `#include <iostream>
using namespace std;
int main() {
    try {
        cout << "hello" << endl;
    } catch (exception& e) {
        cout << "error" << endl;
    }
    return 0;
}`
      const result = roundTripCode(code)
      expect(result).toContain('try {')
      expect(result).toContain('catch (exception& e)')
      expect(result).toContain('cout')
      expect(result).toContain('"hello"')
      expect(result).toContain('"error"')
    })

    it('try-catch preserves catch type and name', () => {
      const code = `try {
    int x = 1;
} catch (runtime_error& err) {
    int y = 2;
}`
      const result = roundTripCode(code)
      expect(result).toContain('catch (runtime_error& err)')
    })

    it('try-catch with int catch type', () => {
      const code = `try {
    int x = 1;
} catch (int& e) {
    int y = 2;
}`
      const result = roundTripCode(code)
      expect(result).toContain('catch (int& e)')
    })
  })

  describe('cpp_throw', () => {
    it('throw with integer literal', () => {
      const code = `throw 42;`
      const result = roundTripCode(code)
      expect(result).toContain('throw 42;')
    })

    it('throw with variable reference', () => {
      const code = `throw x;`
      const result = roundTripCode(code)
      expect(result).toContain('throw x;')
    })

    it('throw with string literal', () => {
      const code = `throw "error";`
      const result = roundTripCode(code)
      expect(result).toContain('throw')
      expect(result).toContain('error')
    })
  })

  describe('combined try-catch-throw', () => {
    it('throw inside try block', () => {
      const code = `try {
    throw 42;
} catch (int& e) {
    int y = 0;
}`
      const result = roundTripCode(code)
      expect(result).toContain('try {')
      expect(result).toContain('throw 42;')
      expect(result).toContain('catch (int& e)')
    })

    it('nested try-catch', () => {
      const code = `try {
    try {
        throw 1;
    } catch (int& e) {
        throw 2;
    }
} catch (int& e) {
    int x = 0;
}`
      const result = roundTripCode(code)
      // Should contain nested try-catch structure
      const tryCount = (result.match(/try\s*\{/g) || []).length
      expect(tryCount).toBe(2)
      const catchCount = (result.match(/catch\s*\(/g) || []).length
      expect(catchCount).toBe(2)
    })

    it('second round-trip produces structurally equivalent tree (P1)', () => {
      const code = `try {
    int x = 10;
} catch (exception& e) {
    int y = 0;
}`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const generated = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(generated)
      expect(tree2).not.toBeNull()

      // Compare structure: same concept at root level
      function findConcept(node: any, concept: string): boolean {
        if (node.concept === concept) return true
        for (const children of Object.values(node.children ?? {})) {
          for (const child of children as any[]) {
            if (findConcept(child, concept)) return true
          }
        }
        return false
      }
      expect(findConcept(tree1!, 'cpp_try_catch')).toBe(true)
      expect(findConcept(tree2!, 'cpp_try_catch')).toBe(true)
    })
  })
})
