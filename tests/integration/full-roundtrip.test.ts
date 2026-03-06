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

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

describe('Full Round-trip (SC-001): All Universal + C++ blocks', () => {
  describe('Declarations', () => {
    it('var_declare with initializer', () => {
      const code = roundTripCode('int x = 5;')
      expect(code).toContain('int x = 5;')
    })

    it('var_declare without initializer', () => {
      const code = roundTripCode('int y;')
      expect(code).toContain('int y;')
    })

    it('var_assign', () => {
      const code = roundTripCode('x = 10;')
      expect(code).toContain('x = 10;')
    })

    it('array_declare', () => {
      const code = roundTripCode('int arr[10];')
      expect(code).toContain('int arr[10];')
    })
  })

  describe('Expressions', () => {
    it('arithmetic operators', () => {
      const code = roundTripCode('int x = a + b;')
      expect(code).toContain('a + b')
    })

    it('comparison operators', () => {
      const code = roundTripCode('if (x > 0) { y = 1; }')
      expect(code).toContain('x > 0')
    })

    it('logical operators', () => {
      const code = roundTripCode('if (x > 0 && y < 10) { z = 1; }')
      expect(code).toContain('&&')
    })

    it('logical not', () => {
      const code = roundTripCode('if (!done) { x = 1; }')
      expect(code).toContain('!')
    })

    it('negate (unary minus)', () => {
      const code = roundTripCode('int x = -5;')
      expect(code).toContain('-5')
    })

    it('number literal', () => {
      const code = roundTripCode('int x = 42;')
      expect(code).toContain('42')
    })

    it('string literal', () => {
      const code = roundTripCode('cout << "hello";')
      expect(code).toContain('"hello"')
    })

    it('var_ref in expression', () => {
      const code = roundTripCode('int y = x;')
      expect(code).toContain('y = x')
    })
  })

  describe('Control Flow', () => {
    it('if statement', () => {
      const code = roundTripCode('if (x > 0) {\n    y = 1;\n}')
      expect(code).toContain('if (x > 0)')
      expect(code).toContain('y = 1;')
    })

    it('if-else statement', () => {
      const code = roundTripCode('if (x > 0) {\n    y = 1;\n} else {\n    y = 2;\n}')
      expect(code).toContain('if (x > 0)')
      expect(code).toContain('else')
      expect(code).toContain('y = 2;')
    })

    it('while loop', () => {
      const code = roundTripCode('while (i < 10) {\n    i = i + 1;\n}')
      expect(code).toContain('while (i < 10)')
    })

    it('for loop (count_loop)', () => {
      const code = roundTripCode('for (int i = 0; i < 10; i++) {\n    x = i;\n}')
      expect(code).toContain('for')
      expect(code).toContain('i')
    })

    it('break statement', () => {
      const code = roundTripCode('while (true) {\n    break;\n}')
      expect(code).toContain('break;')
    })

    it('continue statement', () => {
      const code = roundTripCode('while (true) {\n    continue;\n}')
      expect(code).toContain('continue;')
    })
  })

  describe('Functions', () => {
    it('function definition', () => {
      const code = roundTripCode('int main() {\n    return 0;\n}')
      expect(code).toContain('int main()')
      expect(code).toContain('return 0;')
    })

    it('function with parameters', () => {
      const code = roundTripCode('int add(int a, int b) {\n    return a + b;\n}')
      expect(code).toContain('int add(int a, int b)')
      expect(code).toContain('return a + b;')
    })

    it('void function', () => {
      const code = roundTripCode('void greet() {\n    cout << "hi";\n}')
      expect(code).toContain('void greet()')
    })

    it('return without value', () => {
      const code = roundTripCode('void f() {\n    return;\n}')
      expect(code).toContain('return;')
    })
  })

  describe('I/O', () => {
    it('cout output', () => {
      const code = roundTripCode('cout << x;')
      expect(code).toContain('cout << x')
    })

    it('cin input', () => {
      const code = roundTripCode('cin >> x;')
      expect(code).toContain('cin >> x')
    })
  })

  describe('Comments', () => {
    it('line comment', () => {
      const code = roundTripCode('// hello\nint x = 5;')
      expect(code).toContain('// hello')
      expect(code).toContain('int x = 5;')
    })
  })

  describe('Degradation', () => {
    it('unknown construct degrades to raw_code', () => {
      const code = roundTripCode('template<typename T> class Foo {};')
      expect(code).toContain('template')
    })
  })

  describe('Code → Semantic → Blocks chain', () => {
    it('multiple statements produce chained blocks', () => {
      const tree = liftCode('int x = 5;\nint y = 10;\nx = x + y;')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks).toHaveLength(1)

      let block = state.blocks.blocks[0]
      expect(block.type).toBe('u_var_declare')
      expect(block.next).toBeDefined()

      block = block.next!.block
      expect(block.type).toBe('u_var_declare')
      expect(block.next).toBeDefined()

      block = block.next!.block
      expect(block.type).toBe('u_var_assign')
    })

    it('nested structure produces correct block tree', () => {
      const tree = liftCode('if (x > 0) {\n    y = 1;\n}')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      const ifBlock = state.blocks.blocks[0]
      expect(ifBlock.type).toBe('u_if')
      expect(ifBlock.inputs.CONDITION).toBeDefined()
      expect(ifBlock.inputs.THEN).toBeDefined()
    })

    it('function definition renders with body', () => {
      const tree = liftCode('int main() {\n    return 0;\n}')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      const funcBlock = state.blocks.blocks[0]
      expect(funcBlock.type).toBe('u_func_def')
      expect(funcBlock.inputs.BODY).toBeDefined()
    })
  })
})
