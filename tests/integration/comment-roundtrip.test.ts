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

describe('Block Comment Round-trip', () => {
  it('should lift single-line block comment to block_comment node', () => {
    const tree = liftCode('/* this is a block comment */\nint x = 5;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body
    const commentNode = body.find(n => n.concept === 'block_comment')
    expect(commentNode).toBeDefined()
    expect(commentNode!.properties.text).toBe('this is a block comment')
  })

  it('should lift multi-line block comment preserving content', () => {
    const tree = liftCode('/* line 1\n   line 2\n   line 3 */\nint x = 5;')
    expect(tree).not.toBeNull()
    const body = tree!.children.body
    const commentNode = body.find(n => n.concept === 'block_comment')
    expect(commentNode).toBeDefined()
    expect(commentNode!.properties.text).toContain('line 1')
    expect(commentNode!.properties.text).toContain('line 2')
    expect(commentNode!.properties.text).toContain('line 3')
  })

  it('should generate /* */ code from block_comment', () => {
    const tree = liftCode('/* hello world */\nint x = 5;')
    expect(tree).not.toBeNull()
    const code = generateCode(tree!, 'cpp', style)
    expect(code).toContain('/*')
    expect(code).toContain('hello world')
    expect(code).toContain('*/')
  })

  it('should render block comment as c_comment_block block', () => {
    const tree = liftCode('/* test comment */\nint x = 5;')
    expect(tree).not.toBeNull()
    const state = renderToBlocklyState(tree!)
    const firstBlock = state.blocks.blocks[0]
    expect(firstBlock.type).toBe('c_comment_block')
    expect(firstBlock.fields.TEXT).toBe('test comment')
  })

  it('should round-trip multi-line block comment through code generation', () => {
    const code = '/* multi\n   line */\nint x = 5;'
    const tree = liftCode(code)
    expect(tree).not.toBeNull()
    const generated = generateCode(tree!, 'cpp', style)
    expect(generated).toContain('/*')
    expect(generated).toContain('*/')
    expect(generated).toContain('multi')
    expect(generated).toContain('line')
  })
})

describe('Doc Comment (JSDoc/Doxygen) Round-trip', () => {
  it('should lift /** brief */ to doc_comment with brief', () => {
    const tree = liftCode('/** Calculate sum */\nint add(int a, int b) { return a + b; }')
    expect(tree).not.toBeNull()
    const body = tree!.children.body
    const docNode = body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    expect(docNode!.properties.brief).toBe('Calculate sum')
  })

  it('should lift @brief tag', () => {
    const code = `/**
 * @brief Calculate the sum
 */
int add(int a, int b) { return a + b; }`
    const tree = liftCode(code)
    const docNode = tree!.children.body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    expect(docNode!.properties.brief).toBe('Calculate the sum')
  })

  it('should lift @param tags', () => {
    const code = `/**
 * @brief Add two numbers
 * @param a first number
 * @param b second number
 */
int add(int a, int b) { return a + b; }`
    const tree = liftCode(code)
    const docNode = tree!.children.body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    expect(docNode!.properties.param_0_name).toBe('a')
    expect(docNode!.properties.param_0_desc).toBe('first number')
    expect(docNode!.properties.param_1_name).toBe('b')
    expect(docNode!.properties.param_1_desc).toBe('second number')
  })

  it('should lift @return tag', () => {
    const code = `/**
 * @brief Add
 * @return the sum
 */
int add(int a, int b) { return a + b; }`
    const tree = liftCode(code)
    const docNode = tree!.children.body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    expect(docNode!.properties.return_desc).toBe('the sum')
  })

  it('should generate Doxygen-style doc comment', () => {
    const code = `/**
 * @brief Add two numbers
 * @param a first
 * @param b second
 * @return sum
 */
int add(int a, int b) { return a + b; }`
    const tree = liftCode(code)
    const generated = generateCode(tree!, 'cpp', style)
    expect(generated).toContain('/**')
    expect(generated).toContain('* @brief Add two numbers')
    expect(generated).toContain('* @param a first')
    expect(generated).toContain('* @param b second')
    expect(generated).toContain('* @return sum')
    expect(generated).toContain('*/')
  })

  it('should render doc comment as c_comment_doc block with fields', () => {
    const code = `/**
 * @brief Calculate sum
 * @param x input value
 * @return result
 */
int f(int x) { return x; }`
    const tree = liftCode(code)
    const state = renderToBlocklyState(tree!)
    const firstBlock = state.blocks.blocks[0]
    expect(firstBlock.type).toBe('c_comment_doc')
    expect(firstBlock.fields.BRIEF).toBe('Calculate sum')
    expect(firstBlock.fields.PARAM_NAME_0).toBe('x')
    expect(firstBlock.fields.PARAM_DESC_0).toBe('input value')
    expect(firstBlock.fields.RETURN).toBe('result')
    expect(firstBlock.extraState).toEqual({ paramCount: 1, hasReturn: true })
  })

  it('should generate brief-only doc comment (no params, no return)', () => {
    const code = '/** Just a description */\nint x = 5;'
    const tree = liftCode(code)
    const generated = generateCode(tree!, 'cpp', style)
    expect(generated).toContain('/**')
    expect(generated).toContain('* @brief Just a description')
    expect(generated).toContain('*/')
    expect(generated).not.toContain('@param')
    expect(generated).not.toContain('@return')
  })

  it('should lift multi-line description without tags as brief', () => {
    const code = `/**
 * 計算 (base^exp) % mod
 * 時間複雜度: O(log exp)
 * 空間複雜度: O(1)
 */
int power(int base, int exp, int mod) { return 0; }`
    const tree = liftCode(code)
    const docNode = tree!.children.body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    // All description lines joined as brief
    expect(docNode!.properties.brief).toContain('計算 (base^exp) % mod')
    expect(docNode!.properties.brief).toContain('時間複雜度: O(log exp)')
    expect(docNode!.properties.brief).toContain('空間複雜度: O(1)')
  })

  it('should round-trip multi-line description doc comment', () => {
    const code = `/**
 * 計算 (base^exp) % mod
 * 時間複雜度: O(log exp)
 * 空間複雜度: O(1)
 */
int power(int base, int exp, int mod) { return 0; }`
    const tree = liftCode(code)
    const generated = generateCode(tree!, 'cpp', style)
    expect(generated).toContain('/**')
    expect(generated).toContain('計算 (base^exp) % mod')
    expect(generated).toContain('時間複雜度: O(log exp)')
    expect(generated).toContain('空間複雜度: O(1)')
    expect(generated).toContain('*/')
  })

  it('should lift mixed description + tags', () => {
    const code = `/**
 * 計算兩數之和
 * 使用簡單加法
 * @param a 第一個數
 * @param b 第二個數
 * @return 兩數之和
 */
int add(int a, int b) { return a + b; }`
    const tree = liftCode(code)
    const docNode = tree!.children.body.find(n => n.concept === 'doc_comment')
    expect(docNode).toBeDefined()
    expect(docNode!.properties.brief).toContain('計算兩數之和')
    expect(docNode!.properties.brief).toContain('使用簡單加法')
    expect(docNode!.properties.param_0_name).toBe('a')
    expect(docNode!.properties.param_0_desc).toBe('第一個數')
    expect(docNode!.properties.param_1_name).toBe('b')
    expect(docNode!.properties.return_desc).toBe('兩數之和')
  })
})
