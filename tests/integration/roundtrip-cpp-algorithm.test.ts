/**
 * C++ Algorithm Roundtrip Tests
 *
 * Verifies that C++ algorithm concepts (cpp_sort, cpp_reverse, cpp_fill,
 * cpp_min, cpp_max, cpp_swap) survive the full roundtrip:
 * code → lift → generate → re-lift → structural equivalence.
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

describe('C++ Algorithm Roundtrip', () => {

  describe('cpp_sort', () => {
    const code = 'vector<int> v;\nv.push_back(3);\nv.push_back(1);\nv.push_back(2);\nsort(v.begin(), v.end());\ncout << v[0] << endl;'

    it('should lift to cpp_sort concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_sort')
      expect(node).not.toBeNull()
      expect(node!.properties.begin).toBe('v.begin()')
      expect(node!.properties.end).toBe('v.end()')
    })

    it('should generate code containing sort()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('sort(')
      expect(output).toContain('v.begin()')
      expect(output).toContain('v.end()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_sort')
      expect(node2).not.toBeNull()
      expect(node2!.properties.begin).toBe('v.begin()')
    })
  })

  describe('cpp_reverse', () => {
    const code = 'vector<int> v;\nv.push_back(1);\nv.push_back(2);\nv.push_back(3);\nreverse(v.begin(), v.end());\ncout << v[0] << endl;'

    it('should lift to cpp_reverse concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_reverse')
      expect(node).not.toBeNull()
      expect(node!.properties.begin).toBe('v.begin()')
      expect(node!.properties.end).toBe('v.end()')
    })

    it('should generate code containing reverse()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('reverse(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_reverse')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_fill', () => {
    const code = 'vector<int> v;\nv.push_back(0);\nv.push_back(0);\nv.push_back(0);\nfill(v.begin(), v.end(), 42);\ncout << v[0] << endl;'

    it('should lift to cpp_fill concept with value child', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_fill')
      expect(node).not.toBeNull()
      expect(node!.properties.begin).toBe('v.begin()')
      expect(node!.children.value).toBeDefined()
      expect(node!.children.value!.length).toBe(1)
    })

    it('should generate code containing fill()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('fill(')
      expect(output).toContain('42')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_fill')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_min', () => {
    const code = 'int a = 5;\nint b = 3;\ncout << min(a, b) << endl;'

    it('should lift to cpp_min concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_min')
      expect(node).not.toBeNull()
      expect(node!.children.a).toBeDefined()
      expect(node!.children.b).toBeDefined()
    })

    it('should generate code containing min()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('min(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_min')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_max', () => {
    const code = 'int a = 5;\nint b = 3;\ncout << max(a, b) << endl;'

    it('should lift to cpp_max concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_max')
      expect(node).not.toBeNull()
      expect(node!.children.a).toBeDefined()
      expect(node!.children.b).toBeDefined()
    })

    it('should generate code containing max()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('max(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_max')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_swap', () => {
    const code = 'int a = 10;\nint b = 20;\nswap(a, b);\ncout << a << " " << b << endl;'

    it('should lift to cpp_swap concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_swap')
      expect(node).not.toBeNull()
      expect(node!.properties.a).toBe('a')
      expect(node!.properties.b).toBe('b')
    })

    it('should generate code containing swap()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('swap(a, b)')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_swap')
      expect(node2).not.toBeNull()
    })
  })

  describe('combo: min + max', () => {
    const code = 'int x = 7;\nint y = 3;\nint z = 5;\ncout << min(x, y) << endl;\ncout << max(y, z) << endl;'

    it('should lift both cpp_min and cpp_max', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_min')).toBe(true)
      expect(concepts.has('cpp_max')).toBe(true)
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_min')).toBe(true)
      expect(concepts2.has('cpp_max')).toBe(true)
    })
  })

  describe('combo: sort + reverse', () => {
    const code = 'vector<int> v;\nv.push_back(5);\nv.push_back(2);\nv.push_back(8);\nv.push_back(1);\nsort(v.begin(), v.end());\ncout << v[0] << endl;\nreverse(v.begin(), v.end());\ncout << v[0] << endl;'

    it('should lift both cpp_sort and cpp_reverse', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_sort')).toBe(true)
      expect(concepts.has('cpp_reverse')).toBe(true)
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_sort')).toBe(true)
      expect(concepts2.has('cpp_reverse')).toBe(true)
    })
  })
})
