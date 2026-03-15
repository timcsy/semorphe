/**
 * C++ Map Operations Roundtrip Tests
 *
 * Verifies that C++ map concepts (cpp_map_declare, cpp_container_erase,
 * cpp_container_count, cpp_map_empty, cpp_map_access) survive the full roundtrip.
 *
 * Note: .empty() maps to cpp_container_empty (shared method).
 * Note: m[key] maps to array_access (no type info to distinguish map from array).
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

describe('C++ Map Operations Roundtrip', () => {

  describe('cpp_map_declare', () => {
    const code = 'map<string, int> freq;\ncout << "created" << endl;'

    it('should lift to cpp_map_declare with key_type and value_type', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_map_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.key_type).toBe('string')
      expect(node!.properties.value_type).toBe('int')
      expect(node!.properties.name).toBe('freq')
    })

    it('should generate code containing map<string, int>', () => {
      const output = roundTripCode(code)
      expect(output).toContain('map<string, int>')
      expect(output).toContain('freq;')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_map_declare')
      expect(node2).not.toBeNull()
      expect(node2!.properties.key_type).toBe('string')
      expect(node2!.properties.value_type).toBe('int')
    })
  })

  describe('cpp_map_declare (int, int)', () => {
    const code = 'map<int, int> mp;\ncout << "ok" << endl;'

    it('should lift with both types as int', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_map_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.key_type).toBe('int')
      expect(node!.properties.value_type).toBe('int')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_map_declare')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_container_erase', () => {
    const code = 'map<string, int> mp;\nmp.erase("hello");\ncout << "erased" << endl;'

    it('should lift to cpp_container_erase with obj and key', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_erase')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('mp')
      expect(node!.children.key).toBeDefined()
      expect(node!.children.key!.length).toBe(1)
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

  describe('cpp_container_count', () => {
    const code = 'map<string, int> mp;\nif (mp.count("key")) {\n    cout << "found" << endl;\n}'

    it('should lift to cpp_container_count with obj and key', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_count')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('mp')
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

  describe('cpp_map_access (degrades to array_access)', () => {
    const code = 'map<string, int> mp;\ncout << mp["key"] << endl;'

    it('should lift m[key] as array_access (no type info)', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      // Without type info, subscript lifts as array_access
      expect(concepts.has('array_access')).toBe(true)
    })

    it('should survive P1 structural equivalence despite degradation', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('array_access')).toBe(true)
    })
  })

  describe('cpp_map_empty (via cpp_container_empty)', () => {
    const code = 'map<int, int> mp;\nif (mp.empty()) {\n    cout << "empty" << endl;\n}'

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

  describe('combo: map declare + erase + count + empty', () => {
    const code = 'map<int, int> mp;\nmp.erase(5);\nif (mp.count(3)) {\n    cout << "found" << endl;\n}\ncout << mp.empty() << endl;'

    it('should lift all map concepts', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_map_declare')).toBe(true)
      expect(concepts.has('cpp_container_erase')).toBe(true)
      expect(concepts.has('cpp_container_count')).toBe(true)
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_map_declare')).toBe(true)
      expect(concepts2.has('cpp_container_erase')).toBe(true)
      expect(concepts2.has('cpp_container_count')).toBe(true)
    })
  })
})
