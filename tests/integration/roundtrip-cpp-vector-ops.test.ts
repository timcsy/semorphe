/**
 * C++ Vector Operations Roundtrip Tests
 *
 * Verifies that C++ vector operation concepts (cpp_vector_declare, cpp_vector_push_back,
 * cpp_vector_size, cpp_vector_pop_back, cpp_vector_clear, cpp_vector_empty, cpp_vector_back)
 * survive the full roundtrip:
 *
 *   C++ code → (tree-sitter parse) → AST → (lift) → SemanticTree
 *     → (generate) → C++ code → (re-lift) → SemanticTree  [P1 structural equivalence]
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

/** Recursively search for a concept in the semantic tree */
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

/** Collect all concept IDs present in a semantic tree */
function collectConcepts(node: SemanticNode | null, result: Set<string> = new Set()): Set<string> {
  if (!node) return result
  result.add(node.concept)
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      collectConcepts(child, result)
    }
  }
  return result
}

describe('C++ Vector Operations Roundtrip', () => {

  // ─── 1. cpp_vector_declare ────────────────────────────────

  describe('cpp_vector_declare', () => {
    const code = 'vector<int> v;\ncout << v.size() << endl;'

    it('should lift to cpp_vector_declare concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.type).toBe('int')
      expect(node!.properties.name).toBe('v')
    })

    it('should generate code containing vector<int>', () => {
      const output = roundTripCode(code)
      expect(output).toContain('vector<int>')
      expect(output).toContain(' v;')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_declare')
      expect(node2).not.toBeNull()
      expect(node2!.properties.type).toBe('int')
      expect(node2!.properties.name).toBe('v')
    })
  })

  // ─── 2. cpp_vector_push_back ──────────────────────────────

  describe('cpp_vector_push_back', () => {
    const code = 'vector<int> v;\nv.push_back(10);\nv.push_back(20);\nv.push_back(30);\ncout << v.size() << endl;'

    it('should lift to cpp_vector_push_back concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_push_back')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .push_back()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.push_back(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_push_back')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 3. cpp_vector_size ───────────────────────────────────

  describe('cpp_vector_size', () => {
    const code = 'vector<int> v;\nv.push_back(1);\nv.push_back(2);\nint n = v.size();\ncout << n << endl;'

    it('should lift to cpp_vector_size concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_size')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .size()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.size()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_size')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 4. cpp_vector_pop_back ───────────────────────────────

  describe('cpp_vector_pop_back', () => {
    const code = 'vector<int> v;\nv.push_back(1);\nv.push_back(2);\nv.push_back(3);\nv.pop_back();\ncout << v.size() << endl;'

    it('should lift to cpp_vector_pop_back concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_pop_back')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .pop_back()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.pop_back()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_pop_back')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 5. cpp_vector_clear ──────────────────────────────────

  describe('cpp_vector_clear', () => {
    const code = 'vector<int> v;\nv.push_back(1);\nv.push_back(2);\nv.clear();\ncout << v.size() << endl;'

    it('should lift to cpp_vector_clear concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_clear')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .clear()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.clear()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_clear')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 6. cpp_vector_empty ──────────────────────────────────

  describe('cpp_vector_empty', () => {
    const code = 'vector<int> v;\nif (v.empty()) {\n    cout << "empty" << endl;\n}'

    it('should lift to cpp_vector_empty concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_empty')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .empty()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.empty()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_empty')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 7. cpp_vector_back ───────────────────────────────────

  describe('cpp_vector_back', () => {
    const code = 'vector<int> v;\nv.push_back(10);\nv.push_back(20);\ncout << v.back() << endl;'

    it('should lift to cpp_vector_back concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_vector_back')
      expect(node).not.toBeNull()
      expect(node!.properties.vector).toBe('v')
    })

    it('should generate code containing .back()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.back()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_vector_back')
      expect(node2).not.toBeNull()
      expect(node2!.properties.vector).toBe('v')
    })
  })

  // ─── 8. Combo: push_back + size + back ────────────────────

  describe('combo: push_back + size + back', () => {
    const code = 'vector<int> v;\nv.push_back(5);\nv.push_back(10);\nv.push_back(15);\ncout << v.size() << endl;\ncout << v.back() << endl;'

    it('should lift all vector concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_vector_declare')).toBe(true)
      expect(concepts.has('cpp_vector_push_back')).toBe(true)
      expect(concepts.has('cpp_vector_size')).toBe(true)
      expect(concepts.has('cpp_vector_back')).toBe(true)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_vector_declare')).toBe(true)
      expect(concepts2.has('cpp_vector_push_back')).toBe(true)
      expect(concepts2.has('cpp_vector_size')).toBe(true)
      expect(concepts2.has('cpp_vector_back')).toBe(true)
    })
  })

  // ─── 9. Combo: push_back + pop_back + empty ───────────────

  describe('combo: push_back + pop_back + empty', () => {
    const code = 'vector<int> v;\nv.push_back(1);\nv.push_back(2);\nv.pop_back();\nv.pop_back();\nif (v.empty()) {\n    cout << "all gone" << endl;\n}'

    it('should lift all vector concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_vector_push_back')).toBe(true)
      expect(concepts.has('cpp_vector_pop_back')).toBe(true)
      expect(concepts.has('cpp_vector_empty')).toBe(true)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_vector_push_back')).toBe(true)
      expect(concepts2.has('cpp_vector_pop_back')).toBe(true)
      expect(concepts2.has('cpp_vector_empty')).toBe(true)
    })
  })

  // ─── 10. Combo: push_back + clear + size ──────────────────

  describe('combo: push_back + clear + size', () => {
    const code = 'vector<int> v;\nv.push_back(100);\nv.push_back(200);\nv.push_back(300);\nv.clear();\ncout << v.size() << endl;'

    it('should lift all vector concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_vector_push_back')).toBe(true)
      expect(concepts.has('cpp_vector_clear')).toBe(true)
      expect(concepts.has('cpp_vector_size')).toBe(true)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_vector_push_back')).toBe(true)
      expect(concepts2.has('cpp_vector_clear')).toBe(true)
      expect(concepts2.has('cpp_vector_size')).toBe(true)
    })
  })
})
