import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { generateCode } from '../../src/core/projection/code-generator'
import type { StylePreset } from '../../src/core/types'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import competitiveStyle from '../../src/languages/cpp/styles/competitive.json'
import googleStyle from '../../src/languages/cpp/styles/google.json'

const APCS = apcsStyle as StylePreset
const COMPETITIVE = competitiveStyle as StylePreset
const GOOGLE = googleStyle as StylePreset

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
})

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

describe('Style Preset Loading', () => {
  it('should load apcs preset with correct values', () => {
    expect(APCS.id).toBe('apcs')
    expect(APCS.io_style).toBe('cout')
    expect(APCS.indent_size).toBe(4)
    expect(APCS.naming_convention).toBe('camelCase')
  })

  it('should load competitive preset with printf', () => {
    expect(COMPETITIVE.id).toBe('competitive')
    expect(COMPETITIVE.io_style).toBe('printf')
    expect(COMPETITIVE.header_style).toBe('bits')
  })

  it('should load google preset with 2-space indent', () => {
    expect(GOOGLE.id).toBe('google')
    expect(GOOGLE.indent_size).toBe(2)
    expect(GOOGLE.namespace_style).toBe('explicit')
  })
})

describe('Style Switching — same semantic tree, different code output', () => {
  it('should generate different indent sizes', () => {
    const tree = liftCode('int main() {\n    return 0;\n}')
    expect(tree).not.toBeNull()

    const apcsCode = generateCode(tree!, 'cpp', APCS)
    const googleCode = generateCode(tree!, 'cpp', GOOGLE)

    // APCS: 4 spaces
    expect(apcsCode).toMatch(/^ {4}return/m)
    // Google: 2 spaces
    expect(googleCode).toMatch(/^ {2}return/m)
  })

  it('should generate cout vs printf for print', () => {
    const tree = liftCode('printf("%d", x);')
    expect(tree).not.toBeNull()

    const apcsCode = generateCode(tree!, 'cpp', APCS)
    const compCode = generateCode(tree!, 'cpp', COMPETITIVE)

    // APCS uses cout
    expect(apcsCode).toContain('cout')
    // Competitive uses printf
    expect(compCode).toContain('printf')
  })

  it('should preserve semantic tree across style switches', () => {
    const code = 'int x = 5;'
    const tree = liftCode(code)
    expect(tree).not.toBeNull()

    const code1 = generateCode(tree!, 'cpp', APCS)
    const code2 = generateCode(tree!, 'cpp', COMPETITIVE)
    const code3 = generateCode(tree!, 'cpp', GOOGLE)

    // All should contain the same semantic content
    expect(code1).toContain('int x = 5;')
    expect(code2).toContain('int x = 5;')
    expect(code3).toContain('int x = 5;')
  })
})
