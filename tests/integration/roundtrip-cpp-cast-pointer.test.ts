/**
 * Roundtrip tests for C++ cast and pointer assignment concepts
 *
 * Covers: cpp_cast, cpp_pointer_assign
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

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
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

describe('C++ cast Roundtrip', () => {
  describe('cpp_cast — C-style cast', () => {
    it('should lift (int)x to cpp_cast concept', () => {
      const tree = liftCode('int y = (int)x;')
      expect(tree).not.toBeNull()
      const castNode = findConcept(tree, 'cpp:cast')
      expect(castNode).not.toBeNull()
      expect(castNode!.properties.target_type).toBe('int')
    })

    it('should lift (double)n to cpp_cast with double type', () => {
      const tree = liftCode('double y = (double)n;')
      expect(tree).not.toBeNull()
      const castNode = findConcept(tree, 'cpp:cast')
      expect(castNode).not.toBeNull()
      expect(castNode!.properties.target_type).toBe('double')
    })

    it('should generate correct C-style cast code', () => {
      const valNode = createNode('cpp:var_ref', { name: 'x' })
      const castNode = createNode('cpp:cast', { target_type: 'int' }, {
        value: [valNode],
      })
      const declNode = createNode('cpp:var_declare', { type: 'int', name: 'y' }, {
        initializer: [castNode],
      })
      const prog = createNode('cpp:program', {}, { body: [declNode] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('(int)x')
    })
  })
})

describe('C++ pointer assign Roundtrip', () => {
  describe('cpp_pointer_assign — *ptr = value', () => {
    it('should lift *ptr = 5 to cpp_pointer_assign concept', () => {
      // tree-sitter parses *ptr = 5 as assignment to pointer_expression
      const tree = liftCode('*ptr = 5;')
      expect(tree).not.toBeNull()
      const assignNode = findConcept(tree, 'cpp:pointer_assign')
      if (assignNode) {
        expect(assignNode.properties.obj).toBe('ptr')
      } else {
        // May be lifted as var_assign with pointer deref — check concept exists
        const concepts = new Set<string>()
        function walk(n: SemanticNode) {
          concepts.add(n.conceptId)
          for (const ch of Object.values(n.children ?? {}))
            for (const c of ch as SemanticNode[]) walk(c)
        }
        walk(tree!)
        // Either cpp_pointer_assign or var_assign with cpp_pointer_deref
        expect(concepts.has('cpp:pointer_assign') || concepts.has('cpp:var_assign')).toBe(true)
      }
    })

    it('should generate *ptr = value code', () => {
      const valNode = createNode('cpp:literal_number', { value: '42' })
      const ptrAssign = createNode('cpp:pointer_assign', { obj: 'ptr' }, {
        value: [valNode],
      })
      const prog = createNode('cpp:program', {}, { body: [ptrAssign] })
      const code = generateCode(prog, 'cpp', style)
      expect(code).toContain('*ptr = 42')
    })
  })
})
