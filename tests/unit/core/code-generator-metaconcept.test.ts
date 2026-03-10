/**
 * TDD tests for Phase A Item 6: code-generator meta-concept if-else → generator Map
 *
 * After refactoring, meta-concepts (raw_code, unresolved, comment, doc_comment, block_comment)
 * should be registered as regular generators, not handled by if-else chain.
 */
import { describe, it, expect } from 'vitest'
import { generateNode, type GeneratorContext, registerMetaConceptGenerators } from '../../../src/core/projection/code-generator'
import type { SemanticNode } from '../../../src/core/types'

function makeNode(concept: string, props: Record<string, any> = {}, children: Record<string, SemanticNode[]> = {}, meta?: Record<string, any>): SemanticNode {
  return {
    id: 'test-1',
    concept,
    properties: props,
    children,
    metadata: meta,
  }
}

function makeCtx(generators?: Map<string, any>): GeneratorContext {
  const gens = generators ?? new Map()
  // Register meta-concept generators into the map
  registerMetaConceptGenerators(gens)
  return {
    indent: 0,
    style: { id: 'test', name: {}, io_style: 'cout', naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R', namespace_style: 'using', header_style: 'bits' },
    language: 'cpp',
    generators: gens,
  }
}

describe('meta-concept generators', () => {
  it('registerMetaConceptGenerators registers 5 generators', () => {
    const map = new Map()
    registerMetaConceptGenerators(map)
    expect(map.has('raw_code')).toBe(true)
    expect(map.has('unresolved')).toBe(true)
    expect(map.has('comment')).toBe(true)
    expect(map.has('doc_comment')).toBe(true)
    expect(map.has('block_comment')).toBe(true)
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
    const node = makeNode('comment', { text: 'hello world' })
    const result = generateNode(node, ctx)
    expect(result).toBe('// hello world\n')
  })

  it('doc_comment generator produces /** ... */', () => {
    const ctx = makeCtx()
    const node = makeNode('doc_comment', { brief: 'A function' })
    const result = generateNode(node, ctx)
    expect(result).toContain('/**')
    expect(result).toContain('@brief A function')
    expect(result).toContain('*/')
  })

  it('doc_comment with params and return', () => {
    const ctx = makeCtx()
    const node = makeNode('doc_comment', {
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
    const node = makeNode('block_comment', { text: 'single line' })
    const result = generateNode(node, ctx)
    expect(result).toBe('/* single line */\n')
  })

  it('block_comment multi-line', () => {
    const ctx = makeCtx()
    const node = makeNode('block_comment', { text: 'line1\nline2' })
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
