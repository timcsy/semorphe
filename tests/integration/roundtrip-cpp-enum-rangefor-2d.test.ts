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

describe('Round-trip: enum, range-for, 2D array', () => {
  it('should round-trip enum declaration', () => {
    const tree = liftCode('enum Color { RED, GREEN, BLUE };')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_enum')
    expect(body[0].properties.name).toBe('Color')
    expect(body[0].properties.values).toBe('RED, GREEN, BLUE')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('enum Color { RED, GREEN, BLUE };')
  })

  it('should round-trip range-based for loop', () => {
    const tree = liftCode('for (auto x : vec) {\n    cout << x;\n}')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_range_for')
    expect(body[0].properties.var_type).toBe('auto')
    expect(body[0].properties.var_name).toBe('x')
    expect(body[0].properties.container).toBe('vec')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('for (auto x : vec)')
  })

  it('should round-trip range-for with int type', () => {
    const tree = liftCode('for (int n : arr) {\n    cout << n;\n}')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_range_for')
    expect(body[0].properties.var_type).toBe('int')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('for (int n : arr)')
  })

  it('should round-trip 2D array declaration', () => {
    const tree = liftCode('int arr[3][4];')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_array_2d_declare')
    expect(body[0].properties.type).toBe('int')
    expect(body[0].properties.name).toBe('arr')
    expect(body[0].properties.rows).toBe('3')
    expect(body[0].properties.cols).toBe('4')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('int arr[3][4];')
  })

  it('should round-trip 2D array access', () => {
    const tree = liftCode('int v = arr[0][1];')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    const init = body[0].children.initializer?.[0]
    expect(init?.concept).toBe('cpp_array_2d_access')
    expect(init?.properties.name).toBe('arr')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('arr[0][1]')
  })

  it('should round-trip 2D array assignment', () => {
    const tree = liftCode('arr[1][2] = 5;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_array_2d_assign')
    expect(body[0].properties.name).toBe('arr')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('arr[1][2] = 5;')
  })

  it('should not break 1D array access', () => {
    const tree = liftCode('int v = arr[3];')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    const init = body[0].children.initializer?.[0]
    expect(init?.concept).toBe('array_access')
  })
})
