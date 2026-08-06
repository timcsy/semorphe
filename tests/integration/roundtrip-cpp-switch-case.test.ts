/**
 * Roundtrip tests for C++ switch/case/default concepts
 *
 * Covers: cpp_case, cpp_default (within cpp_switch)
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
  if (node.conceptId === conceptId) return node
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
  result.add(node.conceptId)
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      collectConcepts(child, result)
    }
  }
  return result
}

describe('C++ switch/case/default Roundtrip', () => {
  describe('cpp_case — basic', () => {
    const code = `switch (x) {
    case 1:
        y = 10;
        break;
    case 2:
        y = 20;
        break;
}`

    it('should lift to cpp_case concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const caseNode = findConcept(tree, 'cpp_case')
      expect(caseNode).not.toBeNull()
    })

    it('should roundtrip switch with cases', () => {
      const generated = roundTripCode(code)
      expect(generated).toContain('case')
      expect(generated).toContain('break')
    })
  })

  describe('cpp_default — basic', () => {
    const code = `switch (x) {
    case 1:
        y = 10;
        break;
    default:
        y = 0;
        break;
}`

    it('should lift to cpp_default concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const defaultNode = findConcept(tree, 'cpp_default')
      expect(defaultNode).not.toBeNull()
    })

    it('should roundtrip switch with default', () => {
      const generated = roundTripCode(code)
      expect(generated).toContain('default')
    })
  })

  describe('cpp_case + cpp_default combined', () => {
    const code = `#include <iostream>
using namespace std;
int main() {
    int x = 2;
    switch (x) {
        case 1:
            cout << "one" << endl;
            break;
        case 2:
            cout << "two" << endl;
            break;
        case 3:
            cout << "three" << endl;
            break;
        default:
            cout << "other" << endl;
            break;
    }
    return 0;
}`

    it('should lift all cases and default', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = collectConcepts(tree)
      expect(concepts.has('cpp_case')).toBe(true)
      expect(concepts.has('cpp_default')).toBe(true)
      expect(concepts.has('cpp_switch')).toBe(true)
    })

    it('should roundtrip complete switch statement', () => {
      const generated = roundTripCode(code)
      expect(generated).toContain('switch')
      expect(generated).toContain('case 1')
      expect(generated).toContain('case 2')
      expect(generated).toContain('case 3')
      expect(generated).toContain('default')
    })
  })
})
