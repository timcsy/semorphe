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

describe('Round-trip: bitwise operators and sizeof', () => {
  it('should round-trip bitwise AND', () => {
    const tree = liftCode('int a = x & y;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    const decl = body[0]
    expect(decl.concept).toBe('var_declare')
    const init = decl.children.initializer?.[0]
    expect(init?.concept).toBe('arithmetic')
    expect(init?.properties.operator).toBe('&')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x & y')
  })

  it('should round-trip bitwise OR', () => {
    const tree = liftCode('int b = x | y;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x | y')
  })

  it('should round-trip bitwise XOR', () => {
    const tree = liftCode('int c = x ^ y;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x ^ y')
  })

  it('should round-trip left shift', () => {
    const tree = liftCode('int d = x << 2;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x << 2')
  })

  it('should round-trip right shift', () => {
    const tree = liftCode('int e = x >> 1;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('x >> 1')
  })

  it('should round-trip sizeof(type)', () => {
    const tree = liftCode('int f = sizeof(int);')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    const decl = body[0]
    const init = decl.children.initializer?.[0]
    expect(init?.concept).toBe('cpp_sizeof')
    expect(init?.properties.target).toBe('int')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('sizeof(int)')
  })

  it('should round-trip sizeof(variable)', () => {
    const tree = liftCode('int g = sizeof(x);')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    const init = body[0].children.initializer?.[0]
    expect(init?.concept).toBe('cpp_sizeof')
    expect(init?.properties.target).toBe('x')

    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('sizeof(x)')
  })

  it('should not break cout chain with << operator', () => {
    const tree = liftCode('cout << x << endl;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body ?? []
    expect(body[0].concept).toBe('print')
  })
})
