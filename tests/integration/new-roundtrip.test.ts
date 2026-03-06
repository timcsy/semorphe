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

describe('New Round-trip: code → semantic tree → code', () => {
  it('should round-trip variable declaration', () => {
    const tree = liftCode('int x = 5;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('int x = 5;')
  })

  it('should round-trip variable assignment', () => {
    const tree = liftCode('x = 10;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x = 10;')
  })

  it('should round-trip arithmetic expression', () => {
    const tree = liftCode('int y = a + b;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('int y = a + b;')
  })

  it('should round-trip if statement', () => {
    const tree = liftCode('if (x > 0) {\n    y = 1;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('if (x > 0)')
    expect(code).toContain('y = 1;')
  })

  it('should round-trip if-else', () => {
    const tree = liftCode('if (x > 0) {\n    y = 1;\n} else {\n    y = 2;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('if (x > 0)')
    expect(code).toContain('else')
    expect(code).toContain('y = 2;')
  })

  it('should round-trip while loop', () => {
    const tree = liftCode('while (i < 10) {\n    i = i + 1;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('while (i < 10)')
  })

  it('should round-trip function definition', () => {
    const tree = liftCode('int main() {\n    return 0;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('int main()')
    expect(code).toContain('return 0;')
  })

  it('should round-trip function with params', () => {
    const tree = liftCode('int add(int a, int b) {\n    return a + b;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('int add(int a, int b)')
    expect(code).toContain('return a + b;')
  })

  it('should degrade unknown constructs to raw_code', () => {
    const tree = liftCode('template<typename T> class Foo {};')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('template')
  })
})

describe('New Round-trip: code → semantic tree → blocks', () => {
  it('should produce valid block state from code', () => {
    const tree = liftCode('int x = 5;')
    expect(tree).not.toBeNull()
    const state = renderToBlocklyState(tree!)
    expect(state.blocks.blocks).toHaveLength(1)
    expect(state.blocks.blocks[0].type).toBe('u_var_declare')
  })

  it('should produce chained blocks for multiple statements', () => {
    const tree = liftCode('int x = 5;\nint y = 10;')
    expect(tree).not.toBeNull()
    const state = renderToBlocklyState(tree!)
    expect(state.blocks.blocks).toHaveLength(1) // chained
    expect(state.blocks.blocks[0].next).toBeDefined()
  })
})
