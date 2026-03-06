import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
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

describe('Comment Round-trip (US7)', () => {
  it('should lift line comment to comment node', () => {
    const tree = liftCode('// this is a comment\nint x = 5;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body
    expect(body.length).toBeGreaterThanOrEqual(2)
    const commentNode = body.find(n => n.concept === 'comment')
    expect(commentNode).toBeDefined()
    expect(commentNode!.properties.text).toBe('this is a comment')
  })

  it('should generate code that preserves comment', () => {
    const tree = liftCode('// hello world\nint x = 5;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('// hello world')
    expect(code).toContain('int x = 5;')
  })

  it('should render comment as c_comment_line block', () => {
    const tree = liftCode('// test comment\nint x = 5;')
    expect(tree).not.toBeNull()
    const state = renderToBlocklyState(tree!)
    expect(state.blocks.blocks).toHaveLength(1)
    // First block in chain should be comment
    const firstBlock = state.blocks.blocks[0]
    expect(firstBlock.type).toBe('c_comment_line')
    expect(firstBlock.fields.TEXT).toBe('test comment')
    // Should chain to var_declare
    expect(firstBlock.next).toBeDefined()
    expect(firstBlock.next!.block.type).toBe('u_var_declare')
  })

  it('should handle multiple comments', () => {
    const tree = liftCode('// first\n// second\nint x = 5;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body
    const comments = body.filter(n => n.concept === 'comment')
    expect(comments.length).toBe(2)
  })
})
