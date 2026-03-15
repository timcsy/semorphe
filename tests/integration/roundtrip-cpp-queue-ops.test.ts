/**
 * C++ Queue Operations Roundtrip Tests
 *
 * Verifies that C++ queue concepts (cpp_queue_declare, cpp_queue_push,
 * cpp_queue_pop, cpp_queue_front, cpp_queue_empty) survive the full roundtrip.
 *
 * Note: .push()/.pop() are shared methods that lifter maps to cpp_container_push/pop.
 * .empty()/.size() map to cpp_container_empty/size. All generate correct code.
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

describe('C++ Queue Operations Roundtrip', () => {

  describe('cpp_queue_declare', () => {
    const code = 'queue<int> q;\ncout << "created" << endl;'

    it('should lift to cpp_queue_declare concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_queue_declare')
      expect(node).not.toBeNull()
      expect(node!.properties.type).toBe('int')
      expect(node!.properties.name).toBe('q')
    })

    it('should generate code containing queue<int>', () => {
      const output = roundTripCode(code)
      expect(output).toContain('queue<int>')
      expect(output).toContain(' q;')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_queue_declare')
      expect(node2).not.toBeNull()
      expect(node2!.properties.type).toBe('int')
    })
  })

  describe('cpp_queue_push (via cpp_container_push)', () => {
    const code = 'queue<int> q;\nq.push(10);\nq.push(20);\ncout << "pushed" << endl;'

    it('should lift .push() to cpp_container_push (shared method)', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_push')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('q')
    })

    it('should generate code containing .push()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.push(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_container_push')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_queue_front', () => {
    const code = 'queue<int> q;\nq.push(42);\ncout << q.front() << endl;'

    it('should lift to cpp_queue_front concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_queue_front')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('q')
    })

    it('should generate code containing .front()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.front()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_queue_front')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_queue_pop (via cpp_container_pop)', () => {
    const code = 'queue<int> q;\nq.push(1);\nq.push(2);\nq.pop();\ncout << q.front() << endl;'

    it('should lift .pop() to cpp_container_pop (shared method)', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_container_pop')
      expect(node).not.toBeNull()
    })

    it('should generate code containing .pop()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.pop()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_container_pop')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_queue_empty (via cpp_container_empty)', () => {
    const code = 'queue<int> q;\nif (q.empty()) {\n    cout << "empty" << endl;\n}'

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

  describe('combo: FIFO drain loop', () => {
    const code = 'queue<int> q;\nq.push(10);\nq.push(20);\nq.push(30);\nwhile (!q.empty()) {\n    cout << q.front() << endl;\n    q.pop();\n}'

    it('should lift all queue concepts', () => {
      const tree = liftCode(code)
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_queue_declare')).toBe(true)
      expect(concepts.has('cpp_container_push')).toBe(true)
      expect(concepts.has('cpp_queue_front')).toBe(true)
      expect(concepts.has('cpp_container_pop')).toBe(true)
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const concepts2 = collectConcepts(tree2)
      expect(concepts2.has('cpp_queue_declare')).toBe(true)
      expect(concepts2.has('cpp_container_push')).toBe(true)
      expect(concepts2.has('cpp_queue_front')).toBe(true)
      expect(concepts2.has('cpp_container_pop')).toBe(true)
    })
  })
})
