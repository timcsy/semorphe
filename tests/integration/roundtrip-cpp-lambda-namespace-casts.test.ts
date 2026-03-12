/**
 * Roundtrip Tests for Branch 7 (030-cpp-lambda-namespace-casts)
 *
 * Tests: cpp_lambda, cpp_namespace_def, cpp_static_cast, cpp_dynamic_cast,
 *        cpp_reinterpret_cast, cpp_const_cast
 *
 * Pattern: C++ code → lift → semantic tree → generate code → re-lift → verify (P1)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset, SemanticNode } from '../../src/core/types'

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

/** Recursively collect all concept IDs from a semantic tree */
function findConcepts(node: SemanticNode): string[] {
  const concepts: string[] = []
  function walk(n: SemanticNode) {
    if (!n) return
    if (n.concept) concepts.push(n.concept)
    if (n.children) {
      for (const ch of Object.values(n.children)) {
        if (Array.isArray(ch)) ch.forEach(walk)
      }
    }
  }
  walk(node)
  return concepts
}

/** Find a node with a specific concept ID in the tree */
function findNode(root: SemanticNode, conceptId: string): SemanticNode | undefined {
  if (root.concept === conceptId) return root
  if (root.children) {
    for (const ch of Object.values(root.children)) {
      if (Array.isArray(ch)) {
        for (const child of ch) {
          const found = findNode(child, conceptId)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

describe('Roundtrip: cpp_lambda, cpp_namespace_def, C++ named casts', () => {
  // ─── Lambda ────────────────────────────────────────────────

  describe('cpp_lambda', () => {
    it('basic lambda: auto f = [](int x) { return x + 1; };', () => {
      const code = 'auto f = [](int x) { return x + 1; };'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_lambda')

      const lambdaNode = findNode(tree!, 'cpp_lambda')
      expect(lambdaNode).toBeDefined()
      expect(lambdaNode!.children.params).toHaveLength(1)
      expect(lambdaNode!.children.params[0].properties.type).toBe('int')
      expect(lambdaNode!.children.params[0].properties.name).toBe('x')

      // Generate code and verify round-trip
      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('[](int x)')
      expect(gen).toContain('return x + 1;')

      // P1: re-lift and verify structure equivalence
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_lambda')
    })

    it('lambda with capture: auto f = [&](int x) { return x * 2; };', () => {
      const code = 'auto f = [&](int x) { return x * 2; };'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_lambda')

      const lambdaNode = findNode(tree!, 'cpp_lambda')
      expect(lambdaNode).toBeDefined()
      expect(lambdaNode!.properties.capture).toBe('&')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('[&]')
      expect(gen).toContain('return x * 2;')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const lambda2 = findNode(tree2!, 'cpp_lambda')
      expect(lambda2).toBeDefined()
      expect(lambda2!.properties.capture).toBe('&')
    })

    it('lambda with trailing return: auto f = [](int x) -> int { return x; };', () => {
      const code = 'auto f = [](int x) -> int { return x; };'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_lambda')

      const lambdaNode = findNode(tree!, 'cpp_lambda')
      expect(lambdaNode).toBeDefined()
      expect(lambdaNode!.properties.return_type).toBe('int')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('-> int')
      expect(gen).toContain('return x;')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const lambda2 = findNode(tree2!, 'cpp_lambda')
      expect(lambda2).toBeDefined()
      expect(lambda2!.properties.return_type).toBe('int')
    })
  })

  // ─── Namespace ─────────────────────────────────────────────

  describe('cpp_namespace_def', () => {
    it('namespace definition: namespace Math { int add(int a, int b) { return a + b; } }', () => {
      const code = 'namespace Math { int add(int a, int b) { return a + b; } }'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_namespace_def')

      const nsNode = findNode(tree!, 'cpp_namespace_def')
      expect(nsNode).toBeDefined()
      expect(nsNode!.properties.name).toBe('Math')
      expect(nsNode!.children.body.length).toBeGreaterThan(0)

      // Should contain func_def inside namespace body
      expect(concepts).toContain('func_def')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('namespace Math')
      expect(gen).toContain('int add(int a, int b)')
      expect(gen).toContain('return a + b;')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_namespace_def')
      const ns2 = findNode(tree2!, 'cpp_namespace_def')
      expect(ns2).toBeDefined()
      expect(ns2!.properties.name).toBe('Math')
    })
  })

  // ─── static_cast ───────────────────────────────────────────

  describe('cpp_static_cast', () => {
    it('static_cast: double d = 3.14; int n = static_cast<int>(d);', () => {
      const code = 'double d = 3.14;\nint n = static_cast<int>(d);'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_static_cast')

      const castNode = findNode(tree!, 'cpp_static_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('int')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('static_cast<int>')
      expect(gen).toContain('double d = 3.14;')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_static_cast')
      const cast2 = findNode(tree2!, 'cpp_static_cast')
      expect(cast2).toBeDefined()
      expect(cast2!.properties.target_type).toBe('int')
    })
  })

  // ─── dynamic_cast ──────────────────────────────────────────

  describe('cpp_dynamic_cast', () => {
    it('dynamic_cast: Base* b = new Derived(); Derived* d = dynamic_cast<Derived*>(b);', () => {
      const code = 'Base* b = new Derived();\nDerived* d = dynamic_cast<Derived*>(b);'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_dynamic_cast')

      const castNode = findNode(tree!, 'cpp_dynamic_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('Derived*')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('dynamic_cast<Derived*>')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_dynamic_cast')
      const cast2 = findNode(tree2!, 'cpp_dynamic_cast')
      expect(cast2).toBeDefined()
      expect(cast2!.properties.target_type).toBe('Derived*')
    })
  })

  // ─── reinterpret_cast ──────────────────────────────────────

  describe('cpp_reinterpret_cast', () => {
    it('reinterpret_cast: int n = 42; void* p = reinterpret_cast<void*>(&n);', () => {
      const code = 'int n = 42;\nvoid* p = reinterpret_cast<void*>(&n);'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_reinterpret_cast')

      const castNode = findNode(tree!, 'cpp_reinterpret_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('void*')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('reinterpret_cast<void*>')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_reinterpret_cast')
      const cast2 = findNode(tree2!, 'cpp_reinterpret_cast')
      expect(cast2).toBeDefined()
      expect(cast2!.properties.target_type).toBe('void*')
    })
  })

  // ─── const_cast ────────────────────────────────────────────

  describe('cpp_const_cast', () => {
    it('const_cast: const int* cp = &n; int* p = const_cast<int*>(cp);', () => {
      const code = 'const int* cp = &n;\nint* p = const_cast<int*>(cp);'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_const_cast')

      const castNode = findNode(tree!, 'cpp_const_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('int*')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('const_cast<int*>')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_const_cast')
      const cast2 = findNode(tree2!, 'cpp_const_cast')
      expect(cast2).toBeDefined()
      expect(cast2!.properties.target_type).toBe('int*')
    })
  })

  // ─── Mixed: namespace with lambda inside ───────────────────

  describe('mixed: namespace with lambda', () => {
    it('namespace containing a lambda assignment', () => {
      const code = `namespace Utils {
    auto f = [](int x) { return x + 1; };
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_namespace_def')
      expect(concepts).toContain('cpp_lambda')

      const nsNode = findNode(tree!, 'cpp_namespace_def')
      expect(nsNode).toBeDefined()
      expect(nsNode!.properties.name).toBe('Utils')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('namespace Utils')
      expect(gen).toContain('[](int x)')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_namespace_def')
      expect(concepts2).toContain('cpp_lambda')
    })
  })

  // ─── Cast in expression context ────────────────────────────

  describe('cast in expression', () => {
    it('static_cast in arithmetic: int result = static_cast<int>(3.14) + 1;', () => {
      const code = 'int result = static_cast<int>(3.14) + 1;'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_static_cast')
      expect(concepts).toContain('arithmetic')

      const castNode = findNode(tree!, 'cpp_static_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('int')

      const gen = generateCode(tree!, 'cpp', style)
      expect(gen).toContain('static_cast<int>')
      expect(gen).toContain('+ 1')

      // P1: re-lift
      const tree2 = liftCode(gen)
      expect(tree2).not.toBeNull()
      const concepts2 = findConcepts(tree2!)
      expect(concepts2).toContain('cpp_static_cast')
      expect(concepts2).toContain('arithmetic')
    })
  })
})
