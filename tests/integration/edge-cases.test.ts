import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
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

describe('Edge Cases', () => {
  describe('Empty and minimal input', () => {
    it('should handle empty code', () => {
      const tree = liftCode('')
      expect(tree).not.toBeNull()
      const code = generateCode(tree!, 'cpp', style)
      expect(code).toBe('')
    })

    it('should handle whitespace-only code', () => {
      const tree = liftCode('   \n\n   ')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks).toHaveLength(0)
    })

    it('should handle single semicolon', () => {
      const tree = liftCode(';')
      expect(tree).not.toBeNull()
    })
  })

  describe('Deeply nested structures', () => {
    it('should handle 5 levels of nested if', () => {
      const code = `
if (a > 0) {
    if (b > 0) {
        if (c > 0) {
            if (d > 0) {
                if (e > 0) {
                    x = 1;
                }
            }
        }
    }
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const generated = generateCode(tree!, 'cpp', style)
      expect(generated).toContain('x = 1;')

      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle nested loops', () => {
      const code = `
for (int i = 0; i < 10; i++) {
    for (int j = 0; j < 10; j++) {
        while (k < 5) {
            k = k + 1;
        }
    }
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const generated = generateCode(tree!, 'cpp', style)
      expect(generated).toContain('k = k + 1')
    })
  })

  describe('Complex expressions', () => {
    it('should handle chained arithmetic', () => {
      const code = 'int x = a + b * c - d;'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const generated = generateCode(tree!, 'cpp', style)
      expect(generated).toContain('int x')
    })

    it('should handle parenthesized expressions', () => {
      const code = 'int x = (a + b) * c;'
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const generated = generateCode(tree!, 'cpp', style)
      expect(generated).toContain('a + b')
      expect(generated).toContain('c')
    })
  })

  describe('Syntax errors (partial sync)', () => {
    it('should not crash on incomplete code', () => {
      const tree = liftCode('int x = ')
      expect(tree).not.toBeNull()
    })

    it('should not crash on mismatched braces', () => {
      const tree = liftCode('if (x > 0) { y = 1;')
      expect(tree).not.toBeNull()
    })

    it('should not crash on random text', () => {
      const tree = liftCode('this is not C++ code at all')
      expect(tree).not.toBeNull()
    })
  })

  describe('Multiple statements', () => {
    it('should handle many sequential statements', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `int v${i} = ${i};`)
      const code = lines.join('\n')
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks).toHaveLength(1)

      let count = 1
      let block = state.blocks.blocks[0]
      while (block.next) {
        block = block.next.block
        count++
      }
      expect(count).toBe(20)
    })
  })

  describe('Mixed constructs', () => {
    it('should handle real-world APCS-style program', () => {
      const code = `
int main() {
    int n;
    cin >> n;
    int sum = 0;
    for (int i = 1; i <= n; i++) {
        sum = sum + i;
    }
    cout << sum;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const generated = generateCode(tree!, 'cpp', style)
      expect(generated).toContain('int main()')
      expect(generated).toContain('cin >> n')
      expect(generated).toContain('sum')
      expect(generated).toContain('return 0;')
    })
  })
})
