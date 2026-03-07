/**
 * Style Preset 切換與淺層覆蓋測試
 *
 * 驗證：(1) apcs→cout (2) competitive→printf (3) google→2-space indent
 * (4) 風格切換後語義樹不變 (5) 自訂參數淺層覆蓋 preset
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { generateCode } from '../../src/core/projection/code-generator'
import { StyleManagerImpl, STYLE_PRESETS } from '../../src/languages/style'
import type { StylePreset } from '../../src/core/types'
import type { CodingStyle, StylePresetId } from '../../src/languages/style'
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

describe('Style Preset — IO Preference', () => {
  it('apcs should generate cout for print', () => {
    const tree = liftCode('printf("%d", x);')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', APCS)
    expect(code).toContain('cout')
  })

  it('competitive should generate printf for print', () => {
    const tree = liftCode('printf("%d", x);')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', COMPETITIVE)
    expect(code).toContain('printf')
  })
})

describe('Style Preset — Indent Size', () => {
  it('google should use 2-space indent', () => {
    const tree = liftCode('int main() {\n    return 0;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', GOOGLE)
    expect(code).toMatch(/^ {2}return/m)
  })

  it('apcs should use 4-space indent', () => {
    const tree = liftCode('int main() {\n    return 0;\n}')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', APCS)
    expect(code).toMatch(/^ {4}return/m)
  })
})

describe('Style Preset — Semantic Tree Invariance', () => {
  it('style switch should not change semantic tree', () => {
    const code = 'int x = 5;'
    const tree = liftCode(code)
    expect(tree).not.toBeNull()

    // Deep copy the tree to JSON for comparison
    const treeBefore = JSON.stringify(tree)

    generateCode(tree!, 'cpp', APCS)
    const treeAfterApcs = JSON.stringify(tree)

    generateCode(tree!, 'cpp', COMPETITIVE)
    const treeAfterComp = JSON.stringify(tree)

    generateCode(tree!, 'cpp', GOOGLE)
    const treeAfterGoogle = JSON.stringify(tree)

    expect(treeAfterApcs).toBe(treeBefore)
    expect(treeAfterComp).toBe(treeBefore)
    expect(treeAfterGoogle).toBe(treeBefore)
  })
})

describe('Style Preset — Shallow Override (mergeWithPreset)', () => {
  it('should override indent while keeping other apcs params', () => {
    const manager = new StyleManagerImpl()
    const merged = manager.mergeWithPreset('apcs', { indent: 2 })

    expect(merged.indent).toBe(2)
    expect(merged.ioPreference).toBe(STYLE_PRESETS.apcs.ioPreference)
    expect(merged.braceStyle).toBe(STYLE_PRESETS.apcs.braceStyle)
    expect(merged.namingConvention).toBe(STYLE_PRESETS.apcs.namingConvention)
    expect(merged.useNamespaceStd).toBe(STYLE_PRESETS.apcs.useNamespaceStd)
    expect(merged.headerStyle).toBe(STYLE_PRESETS.apcs.headerStyle)
  })

  it('should override ioPreference while keeping other competitive params', () => {
    const manager = new StyleManagerImpl()
    const merged = manager.mergeWithPreset('competitive', { ioPreference: 'iostream' })

    expect(merged.ioPreference).toBe('iostream')
    expect(merged.indent).toBe(STYLE_PRESETS.competitive.indent)
    expect(merged.headerStyle).toBe(STYLE_PRESETS.competitive.headerStyle)
    expect(merged.namingConvention).toBe(STYLE_PRESETS.competitive.namingConvention)
  })

  it('should not modify the original preset', () => {
    const manager = new StyleManagerImpl()
    const originalIndent = STYLE_PRESETS.google.indent
    manager.mergeWithPreset('google', { indent: 8 })
    expect(STYLE_PRESETS.google.indent).toBe(originalIndent)
  })
})
