import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'

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

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

describe('cmath Round-trip', () => {
  describe('cpp:math_pow', () => {
    it('pow(x, 2)', () => {
      const code = roundTripCode('double y = pow(x, 2);')
      expect(code).toContain('pow(x, 2)')
    })

    it('pow with expressions', () => {
      const code = roundTripCode('double r = pow(a + b, 3);')
      expect(code).toContain('pow(a + b, 3)')
    })
  })

  describe('cpp:math_unary', () => {
    it('sqrt', () => {
      const code = roundTripCode('double y = sqrt(x);')
      expect(code).toContain('sqrt(x)')
    })

    it('abs', () => {
      const code = roundTripCode('int y = abs(x);')
      expect(code).toContain('abs(x)')
    })

    it('ceil', () => {
      const code = roundTripCode('double y = ceil(x);')
      expect(code).toContain('ceil(x)')
    })

    it('floor', () => {
      const code = roundTripCode('double y = floor(x);')
      expect(code).toContain('floor(x)')
    })

    it('round', () => {
      const code = roundTripCode('double y = round(x);')
      expect(code).toContain('round(x)')
    })

    it('sin', () => {
      const code = roundTripCode('double y = sin(x);')
      expect(code).toContain('sin(x)')
    })

    it('cos', () => {
      const code = roundTripCode('double y = cos(x);')
      expect(code).toContain('cos(x)')
    })

    it('tan', () => {
      const code = roundTripCode('double y = tan(x);')
      expect(code).toContain('tan(x)')
    })

    it('log', () => {
      const code = roundTripCode('double y = log(x);')
      expect(code).toContain('log(x)')
    })

    it('log2', () => {
      const code = roundTripCode('double y = log2(x);')
      expect(code).toContain('log2(x)')
    })

    it('log10', () => {
      const code = roundTripCode('double y = log10(x);')
      expect(code).toContain('log10(x)')
    })

    it('exp', () => {
      const code = roundTripCode('double y = exp(x);')
      expect(code).toContain('exp(x)')
    })

    it('fabs normalizes to abs', () => {
      const code = roundTripCode('double y = fabs(x);')
      expect(code).toContain('abs(x)')
    })

    it('nested: sqrt(pow(x, 2) + pow(y, 2))', () => {
      const code = roundTripCode('double r = sqrt(pow(x, 2) + pow(y, 2));')
      expect(code).toContain('sqrt(')
      expect(code).toContain('pow(x, 2)')
      expect(code).toContain('pow(y, 2)')
    })
  })

  describe('cpp:math_binary', () => {
    it('fmod', () => {
      const code = roundTripCode('double y = fmod(x, 3.14);')
      expect(code).toContain('fmod(x, 3.14)')
    })

    it('hypot', () => {
      const code = roundTripCode('double d = hypot(dx, dy);')
      expect(code).toContain('hypot(dx, dy)')
    })

    it('atan2', () => {
      const code = roundTripCode('double a = atan2(y, x);')
      expect(code).toContain('atan2(y, x)')
    })

    it('fmin', () => {
      const code = roundTripCode('double m = fmin(a, b);')
      expect(code).toContain('fmin(a, b)')
    })

    it('fmax', () => {
      const code = roundTripCode('double m = fmax(a, b);')
      expect(code).toContain('fmax(a, b)')
    })
  })

  describe('Lift semantic structure', () => {
    function findConcept(node: any, conceptId: string): any {
      if (!node) return null
      if (node.concept === conceptId) return node
      for (const children of Object.values(node.children ?? {})) {
        for (const child of children as any[]) {
          const found = findConcept(child, conceptId)
          if (found) return found
        }
      }
      return null
    }

    it('lifts pow to cpp:math_pow concept', () => {
      const tree = liftCode('double y = pow(x, 2);')
      expect(tree).not.toBeNull()
      const pow = findConcept(tree, 'cpp:math_pow')
      expect(pow).not.toBeNull()
      expect(pow.children.base).toHaveLength(1)
      expect(pow.children.exponent).toHaveLength(1)
    })

    it('lifts sqrt to cpp:math_unary with func=sqrt', () => {
      const tree = liftCode('double y = sqrt(x);')
      expect(tree).not.toBeNull()
      const sqrt = findConcept(tree, 'cpp:math_unary')
      expect(sqrt).not.toBeNull()
      expect(sqrt.properties.func).toBe('sqrt')
      expect(sqrt.children.value).toHaveLength(1)
    })

    it('lifts fmod to cpp:math_binary with func=fmod', () => {
      const tree = liftCode('double y = fmod(a, b);')
      expect(tree).not.toBeNull()
      const fmod = findConcept(tree, 'cpp:math_binary')
      expect(fmod).not.toBeNull()
      expect(fmod.properties.func).toBe('fmod')
      expect(fmod.children.arg1).toHaveLength(1)
      expect(fmod.children.arg2).toHaveLength(1)
    })
  })
})
