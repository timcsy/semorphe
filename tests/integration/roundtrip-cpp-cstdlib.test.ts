/**
 * C++ cstdlib Roundtrip Tests
 *
 * Verifies that C++ cstdlib concepts (cpp_random_next, cpp_random_seed, cpp_math_abs, cpp_program_exit,
 * cpp_cstring_as_int, cpp_cstring_as_double) survive the full roundtrip:
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

function findConcept(node: SemanticNode | null, componentId: string): SemanticNode | null {
  if (!node) return null
  if (node.componentId === componentId) return node
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      const found = findConcept(child, componentId)
      if (found) return found
    }
  }
  return null
}

describe('C++ cstdlib Roundtrip', () => {

  describe('cpp:random_next', () => {
    const code = 'int x = rand();'

    it('should lift to cpp_random_next concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:random_next')
      expect(node).not.toBeNull()
    })

    it('should generate code containing rand()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('rand()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:random_next')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp:random_seed', () => {
    const code = 'srand(42);'

    it('should lift to cpp_random_seed concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:random_seed')
      expect(node).not.toBeNull()
    })

    it('should generate code containing srand()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('srand(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:random_seed')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp:math_abs', () => {
    const code = 'int y = abs(-5);'

    it('should lift to cpp_math_abs concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:math_abs')
      expect(node).not.toBeNull()
    })

    it('should generate code containing abs()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('abs(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:math_abs')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp:program_exit', () => {
    const code = 'exit(0);'

    it('should lift to cpp_program_exit concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:program_exit')
      expect(node).not.toBeNull()
    })

    it('should generate code containing exit()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('exit(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:program_exit')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp:cstring_as_int', () => {
    const code = 'int n = atoi("123");'

    it('should lift to cpp_cstring_as_int concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:cstring_as_int')
      expect(node).not.toBeNull()
    })

    it('should generate code containing atoi()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('atoi(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:cstring_as_int')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp:cstring_as_double', () => {
    const code = 'double d = atof("3.14");'

    it('should lift to cpp_cstring_as_double concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp:cstring_as_double')
      expect(node).not.toBeNull()
    })

    it('should generate code containing atof()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('atof(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp:cstring_as_double')
      expect(node2).not.toBeNull()
    })
  })

  describe('combined: srand + rand + abs', () => {
    const code = 'srand(42);\nint x = abs(rand() % 100);\ncout << x << endl;'

    it('should lift all three concepts', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp:random_seed')).not.toBeNull()
      expect(findConcept(tree, 'cpp:random_next')).not.toBeNull()
      expect(findConcept(tree, 'cpp:math_abs')).not.toBeNull()
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp:random_seed')).not.toBeNull()
      expect(findConcept(tree2, 'cpp:random_next')).not.toBeNull()
    })
  })
})
