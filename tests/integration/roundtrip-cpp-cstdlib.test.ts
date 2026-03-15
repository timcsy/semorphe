/**
 * C++ cstdlib Roundtrip Tests
 *
 * Verifies that C++ cstdlib concepts (cpp_rand, cpp_srand, cpp_abs, cpp_exit,
 * cpp_atoi, cpp_atof) survive the full roundtrip:
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

describe('C++ cstdlib Roundtrip', () => {

  describe('cpp_rand', () => {
    const code = 'int x = rand();'

    it('should lift to cpp_rand concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_rand')
      expect(node).not.toBeNull()
    })

    it('should generate code containing rand()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('rand()')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_rand')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_srand', () => {
    const code = 'srand(42);'

    it('should lift to cpp_srand concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_srand')
      expect(node).not.toBeNull()
    })

    it('should generate code containing srand()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('srand(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_srand')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_abs', () => {
    const code = 'int y = abs(-5);'

    it('should lift to cpp_abs concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_abs')
      expect(node).not.toBeNull()
    })

    it('should generate code containing abs()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('abs(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_abs')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_exit', () => {
    const code = 'exit(0);'

    it('should lift to cpp_exit concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_exit')
      expect(node).not.toBeNull()
    })

    it('should generate code containing exit()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('exit(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_exit')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_atoi', () => {
    const code = 'int n = atoi("123");'

    it('should lift to cpp_atoi concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_atoi')
      expect(node).not.toBeNull()
    })

    it('should generate code containing atoi()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('atoi(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_atoi')
      expect(node2).not.toBeNull()
    })
  })

  describe('cpp_atof', () => {
    const code = 'double d = atof("3.14");'

    it('should lift to cpp_atof concept', () => {
      const tree = liftCode(code)
      const node = findConcept(tree, 'cpp_atof')
      expect(node).not.toBeNull()
    })

    it('should generate code containing atof()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('atof(')
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      const node2 = findConcept(tree2, 'cpp_atof')
      expect(node2).not.toBeNull()
    })
  })

  describe('combined: srand + rand + abs', () => {
    const code = 'srand(42);\nint x = abs(rand() % 100);\ncout << x << endl;'

    it('should lift all three concepts', () => {
      const tree = liftCode(code)
      expect(findConcept(tree, 'cpp_srand')).not.toBeNull()
      expect(findConcept(tree, 'cpp_rand')).not.toBeNull()
      expect(findConcept(tree, 'cpp_abs')).not.toBeNull()
    })

    it('should survive P1 structural equivalence', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(findConcept(tree2, 'cpp_srand')).not.toBeNull()
      expect(findConcept(tree2, 'cpp_rand')).not.toBeNull()
    })
  })
})
