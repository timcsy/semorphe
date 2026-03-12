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

describe('Round-trip: const/constexpr/auto/typedef/using alias', () => {
  it('should round-trip const int declaration', () => {
    const tree = liftCode('const int MAX = 100;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body.length).toBe(1)
    expect(body[0].concept).toBe('cpp_const_declare')
    expect(body[0].properties.type).toBe('int')
    expect(body[0].properties.name).toBe('MAX')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('const int MAX = 100;')

    // Second round-trip
    const tree2 = liftCode(code.trim())
    expect(tree2).not.toBeNull()
    const body2 = tree2!.children.body ?? []
    expect(body2.some(n => n.concept === 'cpp_const_declare')).toBe(true)
  })

  it('should round-trip constexpr int declaration', () => {
    const tree = liftCode('constexpr int SIZE = 10;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body.length).toBe(1)
    expect(body[0].concept).toBe('cpp_constexpr_declare')
    expect(body[0].properties.type).toBe('int')
    expect(body[0].properties.name).toBe('SIZE')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('constexpr int SIZE = 10;')
  })

  it('should round-trip auto declaration', () => {
    const tree = liftCode('auto x = 42;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body.length).toBe(1)
    expect(body[0].concept).toBe('cpp_auto_declare')
    expect(body[0].properties.name).toBe('x')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('auto x = 42;')
  })

  it('should round-trip typedef', () => {
    const tree = liftCode('typedef int myint;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body.length).toBe(1)
    expect(body[0].concept).toBe('cpp_typedef')
    expect(body[0].properties.orig_type).toBe('int')
    expect(body[0].properties.alias).toBe('myint')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('typedef int myint;')
  })

  it('should round-trip using alias', () => {
    const tree = liftCode('using ll = long long;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body.length).toBe(1)
    expect(body[0].concept).toBe('cpp_using_alias')
    expect(body[0].properties.alias).toBe('ll')
    expect(body[0].properties.orig_type).toBe('long long')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('using ll = long long;')
  })

  it('should round-trip const with expression initializer', () => {
    const tree = liftCode('const int N = 3 + 4;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_const_declare')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('const int N = 3 + 4;')
  })

  it('should round-trip auto with expression initializer', () => {
    const tree = liftCode('auto y = a + b;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_auto_declare')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('auto y = a + b;')
  })

  it('should round-trip const double', () => {
    const tree = liftCode('const double PI = 3.14;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('cpp_const_declare')
    expect(body[0].properties.type).toBe('double')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('const double PI = 3.14;')
  })
})
