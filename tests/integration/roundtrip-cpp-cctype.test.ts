/**
 * C++ cctype Roundtrip Tests
 *
 * Verifies that C++ cctype concepts (cpp_isalpha, cpp_isdigit, cpp_toupper, cpp_tolower)
 * survive the full roundtrip: code → lift → generate → re-lift → structural equivalence.
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

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

function findConcept(node: SemanticNode | null, conceptId: string): SemanticNode | null {
  if (!node) return null
  if (node.concept === conceptId) return node
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      const found = findConcept(child, conceptId)
      if (found) return found
    }
  }
  return null
}

describe('C++ cctype Roundtrip', () => {

  describe('cpp_isalpha', () => {
    const code = "if (isalpha('A')) { cout << \"yes\" << endl; }"

    it('should lift to cpp_isalpha concept', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_isalpha')).not.toBeNull()
    })

    it('should generate code containing isalpha()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('isalpha(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_isalpha')).not.toBeNull()
    })
  })

  describe('cpp_isdigit', () => {
    const code = "if (isdigit('5')) { cout << \"digit\" << endl; }"

    it('should lift to cpp_isdigit concept', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_isdigit')).not.toBeNull()
    })

    it('should generate code containing isdigit()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('isdigit(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_isdigit')).not.toBeNull()
    })
  })

  describe('cpp_toupper', () => {
    const code = "char c = toupper('a');"

    it('should lift to cpp_toupper concept', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_toupper')).not.toBeNull()
    })

    it('should generate code containing toupper()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('toupper(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_toupper')).not.toBeNull()
    })
  })

  describe('cpp_tolower', () => {
    const code = "char c = tolower('Z');"

    it('should lift to cpp_tolower concept', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_tolower')).not.toBeNull()
    })

    it('should generate code containing tolower()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('tolower(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_tolower')).not.toBeNull()
    })
  })

  describe('combined: all cctype functions', () => {
    const code = `char ch = 'a';
if (isalpha(ch)) {
    cout << (char)toupper(ch) << endl;
}
if (isdigit('3')) {
    cout << "digit" << endl;
}
cout << (char)tolower('Z') << endl;`

    it('should lift all four cctype concepts', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_isalpha')).not.toBeNull()
      expect(findConcept(tree, 'cpp_isdigit')).not.toBeNull()
      expect(findConcept(tree, 'cpp_toupper')).not.toBeNull()
      expect(findConcept(tree, 'cpp_tolower')).not.toBeNull()
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_isalpha')).not.toBeNull()
      expect(findConcept(tree2, 'cpp_toupper')).not.toBeNull()
    })
  })
})
