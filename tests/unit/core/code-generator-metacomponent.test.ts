/**
 * TDD tests for Phase A Item 6: code-generator meta-concept if-else → generator Map
 *
 * After refactoring, meta-concepts (raw_code, unresolved, comment, doc_comment, block_comment)
 * should be registered as regular generators, not handled by if-else chain.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateNode, type GeneratorContext, registerMetaConceptGenerators } from '../../../src/core/projection/code-generator'
import type { SemanticNode } from '../../../src/core/types'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
// ⚠️ 註解那三顆 2026-08-11 搬進膠囊——核心的 `registerMetaConceptGenerators`
// 不再認得它們。少了這一行，這支測試量到的是**生產環境不存在的組態**
// （一個沒有註解產生器的 Map）。
import { componentGenerateRegistrars } from '../../../src/core/component/paths'

// ⚠️ 註解那三個概念的**語法**已搬進 C++ 語言套件（specs/059）。
// 核心只留身分，語法由語言套件推進來——不載入的話這裡測到的是
// **生產環境不存在的組態**（語言中立的退路，不是任何語言的註解）。
beforeAll(() => registerCppLanguage())

function makeNode(concept: string, props: Record<string, any> = {}, children: Record<string, SemanticNode[]> = {}, meta?: Record<string, any>): SemanticNode {
  return {
    id: 'test-1',
    componentId: concept,
    properties: props,
    children,
    metadata: meta,
  }
}

function makeCtx(generators?: Map<string, any>): GeneratorContext {
  const gens = generators ?? new Map()
  // Register meta-concept generators into the map
  registerMetaConceptGenerators(gens)
  // 膠囊自帶的產生器（註解那三顆在這裡）
  const st = { id: 'test', name: {}, io_style: 'cout', naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R', namespace_style: 'using', header_style: 'bits' }
  for (const reg of componentGenerateRegistrars())
    (reg as (m: typeof gens, s: typeof st) => void)(gens, st)
  return {
    indent: 0,
    style: { id: 'test', name: {}, io_style: 'cout', naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R', namespace_style: 'using', header_style: 'bits' },
    language: 'cpp',
    generators: gens,
  }
}

describe('meta-concept generators', () => {
  it('★ 核心只登記真正的元概念——註解那三顆已經是膠囊了', () => {
    const map = new Map()
    registerMetaConceptGenerators(map)
    // `raw_code`／`unresolved` 是**辨識失敗的落點**，沒有語言歸屬——留在核心。
    expect(map.has('raw_code')).toBe(true)
    expect(map.has('unresolved')).toBe(true)
    // ⚠️ 註解那三顆搬進膠囊了，**而這正是要斷言的事**：
    // 核心留下一份就是重複實作，而重複實作沒有人知道輸的那份輸了。
    expect(map.has('cpp:comment'), '核心不該再有註解產生器——它在膠囊裡').toBe(false)
    expect(map.has('cpp:doc_comment')).toBe(false)
    expect(map.has('cpp:block_comment')).toBe(false)
    // 而膠囊那一份必須真的裝得起來（否則上面三個 false 只是「都不見了」）。
    expect(makeCtx().generators.has('cpp:comment'), '膠囊的註解產生器沒裝上').toBe(true)
  })

  it('raw_code generator produces correct output', () => {
    const ctx = makeCtx()
    const node = makeNode('raw_code', { code: 'int x = 5;' })
    const result = generateNode(node, ctx)
    expect(result).toContain('int x = 5;')
  })

  it('raw_code does not indent preprocessor directives', () => {
    const ctx = makeCtx()
    ctx.indent = 1
    const node = makeNode('raw_code', {}, {}, { rawCode: '#include <stdio.h>' })
    const result = generateNode(node, ctx)
    expect(result.startsWith('#')).toBe(true)
  })

  it('unresolved generator produces raw code', () => {
    const ctx = makeCtx()
    const node = makeNode('unresolved', {}, {}, { rawCode: 'some_unknown()' })
    const result = generateNode(node, ctx)
    expect(result).toContain('some_unknown()')
  })

  it('comment generator produces // comment', () => {
    const ctx = makeCtx()
    const node = makeNode('cpp:comment', { text: 'hello world' })
    const result = generateNode(node, ctx)
    expect(result).toBe('// hello world\n')
  })

  it('doc_comment generator produces /** ... */', () => {
    const ctx = makeCtx()
    const node = makeNode('cpp:doc_comment', { brief: 'A function' })
    const result = generateNode(node, ctx)
    expect(result).toContain('/**')
    expect(result).toContain('@brief A function')
    expect(result).toContain('*/')
  })

  it('doc_comment with params and return', () => {
    const ctx = makeCtx()
    const node = makeNode('cpp:doc_comment', {
      brief: 'Add two numbers',
      param_0_name: 'a',
      param_0_desc: 'first number',
      param_1_name: 'b',
      return_desc: 'the sum',
    })
    const result = generateNode(node, ctx)
    expect(result).toContain('@param a first number')
    expect(result).toContain('@param b')
    expect(result).toContain('@return the sum')
  })

  it('block_comment single line', () => {
    const ctx = makeCtx()
    const node = makeNode('cpp:block_comment', { text: 'single line' })
    const result = generateNode(node, ctx)
    expect(result).toBe('/* single line */\n')
  })

  it('block_comment multi-line', () => {
    const ctx = makeCtx()
    const node = makeNode('cpp:block_comment', { text: 'line1\nline2' })
    const result = generateNode(node, ctx)
    expect(result).toContain('/*')
    expect(result).toContain(' * line1')
    expect(result).toContain(' * line2')
    expect(result).toContain(' */')
  })

  it('unknown concept falls through to fallback', () => {
    const ctx = makeCtx()
    const node = makeNode('totally_unknown', {})
    const result = generateNode(node, ctx)
    expect(result).toContain('unknown concept')
  })
})
