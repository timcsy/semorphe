/**
 * C++ Stack Operations Roundtrip Tests
 *
 * Verifies that C++ stack concepts (cpp_stack_declare, cpp_stack_push,
 * cpp_stack_pop, cpp_stack_top, cpp_stack_empty) survive the full roundtrip:
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

describe('C++ Stack Operations Roundtrip', () => {

  // ─── 1. cpp_stack_declare ────────────────────────────────

  describe('cpp_stack_declare', () => {
    const code = 'stack<int> s;\ncout << "created" << endl;'

    it('should lift to cpp_stack_declare concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_stack_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.type).toBe('int')
      expect(node!.properties.name).toBe('s')
    })

    it('should generate code containing stack<int>', () => {
      const output = roundTripCode(code)
      expect(output).toContain('stack<int>')
      expect(output).toContain(' s;')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_stack_declare')
      expect(node2).not.toBeNull()
      expect(node2!.properties.type).toBe('int')
      expect(node2!.properties.name).toBe('s')
    })
  })

  // ─── 2. cpp_stack_push ──────────────────────────────────

  describe('cpp_stack_push', () => {
    const code = 'stack<int> s;\ns.push(10);\ns.push(20);\ns.push(30);\ncout << "pushed" << endl;'

    it('should lift to cpp_stack_push concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_stack_push')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .push()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.push(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_stack_push')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 3. cpp_stack_top ───────────────────────────────────

  describe('cpp_stack_top', () => {
    const code = 'stack<int> s;\ns.push(42);\ncout << s.top() << endl;'

    it('should lift to cpp_stack_top concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_stack_top')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .top()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.top()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_stack_top')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 4. cpp_stack_pop ───────────────────────────────────

  describe('cpp_stack_pop', () => {
    const code = 'stack<int> s;\ns.push(1);\ns.push(2);\ns.push(3);\ns.pop();\ncout << s.top() << endl;'

    it('should lift to cpp_stack_pop concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_stack_pop')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .pop()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.pop()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_stack_pop')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 5. cpp_stack_empty (shared method, lifter maps to cpp_vector_empty) ───

  describe('cpp_stack_empty (via cpp_vector_empty)', () => {
    const code = 'stack<int> s;\nif (s.empty()) {\n    cout << "empty" << endl;\n}'

    it('should lift .empty() to cpp_vector_empty (shared method)', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      // .empty() is a shared method, lifter maps to cpp_vector_empty
      const node = findConcept(tree, 'cpp_vector_empty')
      expect(node).not.toBeNull()
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
    })
  })

  // ─── 6. Combo: push + top + pop ─────────────────────────

  describe('combo: push + top + pop', () => {
    const code = 'stack<int> s;\ns.push(10);\ns.push(20);\ns.push(30);\ncout << s.top() << endl;\ns.pop();\ncout << s.top() << endl;\ns.pop();\ncout << s.top() << endl;'

    it('should lift all stack concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_stack_declare')).toBe(true)
      expect(concepts.has('cpp_stack_push')).toBe(true)
      expect(concepts.has('cpp_stack_top')).toBe(true)
      expect(concepts.has('cpp_stack_pop')).toBe(true)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_stack_declare')).toBe(true)
      expect(concepts2.has('cpp_stack_push')).toBe(true)
      expect(concepts2.has('cpp_stack_top')).toBe(true)
      expect(concepts2.has('cpp_stack_pop')).toBe(true)
    })
  })

  // ─── 7. Combo: push + empty loop ────────────────────────

  describe('combo: push + empty + pop drain loop', () => {
    const code = 'stack<int> s;\ns.push(5);\ns.push(10);\ns.push(15);\nwhile (!s.empty()) {\n    cout << s.top() << endl;\n    s.pop();\n}'

    it('should lift all stack concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_stack_declare')).toBe(true)
      expect(concepts.has('cpp_stack_push')).toBe(true)
      expect(concepts.has('cpp_stack_top')).toBe(true)
      expect(concepts.has('cpp_stack_pop')).toBe(true)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_stack_declare')).toBe(true)
      expect(concepts2.has('cpp_stack_push')).toBe(true)
      expect(concepts2.has('cpp_stack_top')).toBe(true)
      expect(concepts2.has('cpp_stack_pop')).toBe(true)
    })
  })
})
