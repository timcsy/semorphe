/**
 * C++ Set Operations Roundtrip Tests
 *
 * Verifies that C++ set concepts (cpp_set_declare, cpp_set_insert,
 * cpp_set_erase, cpp_set_count, cpp_set_empty) survive the full roundtrip.
 *
 * Note: .erase() maps to cpp_container_erase (shared method).
 * Note: .count() maps to cpp_container_count (shared method).
 * Note: .empty() maps to cpp_container_empty (shared method).
 * All generate correct code regardless of which concept they map to.
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

describe('C++ Set Operations Roundtrip', () => {

  describe('cpp_set_declare', () => {
    const code = 'set<int> s;\ncout << "created" << endl;'

    it('should lift to cpp_set_declare concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_set_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.type).toBe('int')
      expect(node!.properties.name).toBe('s')
    })

    it('should generate code containing set<int>', () => {
      const output = roundTripCode(code)
      expect(output).toContain('set<int>')
      expect(output).toContain(' s;')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_set_declare')
      expect(node2).not.toBeNull()
      expect(node2!.properties.type).toBe('int')
    })
  })

  describe('cpp_set_insert', () => {
    const code = 'set<int> s;\ns.insert(10);\ns.insert(20);\ncout << "inserted" << endl;'

    it('should lift to cpp_set_insert concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_set_insert')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .insert()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.insert(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_set_insert')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_set_erase (via cpp_container_erase)', () => {
    const code = 'set<int> s;\ns.insert(5);\ns.erase(5);\ncout << "erased" << endl;'

    it('should lift .erase() to cpp_container_erase (shared method)', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_erase')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .erase()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.erase(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_container_erase')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_set_count (via cpp_container_count)', () => {
    const code = 'set<int> s;\ns.insert(42);\nif (s.count(42)) {\n    cout << "found" << endl;\n}'

    it('should lift .count() to cpp_container_count (shared method)', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_count')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .count()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.count(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_container_count')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_set_empty (via cpp_container_empty)', () => {
    const code = 'set<int> s;\ncout << s.empty() << endl;'

    it('should lift .empty() to cpp_container_empty (shared method)', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_empty')
      expect(node).not.toBeNull()
    })

    it('should generate code containing .empty()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.empty()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_container_empty')
      expect(node2).not.toBeNull()
    })
  })

  describe('combo: insert + erase + count + empty', () => {
    const code = 'set<int> s;\ns.insert(1);\ns.insert(2);\ns.insert(3);\ns.erase(2);\nif (s.count(2)) {\n    cout << "found" << endl;\n} else {\n    cout << "not found" << endl;\n}\ncout << s.empty() << endl;'

    it('should lift all set concepts', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_set_declare')).toBe(true)
      expect(concepts.has('cpp_set_insert')).toBe(true)
      expect(concepts.has('cpp_container_erase')).toBe(true) // shared
      expect(concepts.has('cpp_container_count')).toBe(true) // shared
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_set_declare')).toBe(true)
      expect(concepts2.has('cpp_set_insert')).toBe(true)
      expect(concepts2.has('cpp_container_erase')).toBe(true)
      expect(concepts2.has('cpp_container_count')).toBe(true)
    })
  })
})
