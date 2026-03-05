/**
 * Diagnostic test: complex expression conversion with adapter
 * Tests parenthesized expressions, unary minus, function calls, and extraState
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import { CppParser } from '../../src/languages/cpp/parser'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import type { BlockSpec } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

interface BlockJSON {
  type: string
  id: string
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlockJSON }>
  extraState?: Record<string, unknown>
  next?: { block: BlockJSON }
}

let registry: BlockRegistry
let parser: CppParser
let adapter: CppLanguageAdapter
let converter: CodeToBlocksConverter

beforeAll(async () => {
  registry = new BlockRegistry()
  const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
  allBlocks.forEach(spec => registry.register(spec))

  adapter = new CppLanguageAdapter()
  parser = new CppParser()
  await parser.init()
  converter = new CodeToBlocksConverter(registry, parser, adapter)
})

function getTopBlocks(result: unknown): BlockJSON[] {
  return (result as any)?.blocks?.blocks ?? []
}

function findBlockByType(block: BlockJSON, type: string): BlockJSON | null {
  if (block.type === type) return block
  if (block.inputs) {
    for (const val of Object.values(block.inputs)) {
      const found = findBlockByType(val.block, type)
      if (found) return found
    }
  }
  if (block.next) {
    const found = findBlockByType(block.next.block, type)
    if (found) return found
  }
  return null
}

describe('Complex expression conversion with adapter', () => {
  it('unary minus: -b → u_arithmetic(0 - b)', async () => {
    const code = 'int x = -b;'
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)
    expect(topBlocks.length).toBe(1)

    const varDecl = topBlocks[0]
    expect(varDecl.type).toBe('u_var_declare')

    // The INIT should be u_arithmetic with OP='-', A=u_number(0), B=u_var_ref(b)
    const init = varDecl.inputs?.INIT?.block
    expect(init?.type).toBe('u_arithmetic')
    expect(init?.fields?.OP).toBe('-')
    expect(init?.inputs?.A?.block?.type).toBe('u_number')
    expect(init?.inputs?.B?.block?.type).toBe('u_var_ref')
    expect(init?.inputs?.B?.block?.fields?.NAME).toBe('b')
  })

  it('parenthesized: (a + b) → unwrap to u_arithmetic', async () => {
    const code = 'int x = (a + b);'
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)

    const init = topBlocks[0]?.inputs?.INIT?.block
    expect(init?.type).toBe('u_arithmetic')
    expect(init?.fields?.OP).toBe('+')
    // Should NOT have parenthesized wrapper
    expect(init?.inputs?.A?.block?.type).toBe('u_var_ref')
  })

  it('function call: sqrt(x) → u_func_call with extraState.argCount', async () => {
    const code = 'double y = sqrt(x);'
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)

    const init = topBlocks[0]?.inputs?.INIT?.block
    expect(init?.type).toBe('u_func_call')
    expect(init?.fields?.NAME).toBe('sqrt')
    expect(init?.inputs?.ARG0?.block?.type).toBe('u_var_ref')
    // CRITICAL: must have extraState.argCount for Blockly deserialization
    expect(init?.extraState?.argCount).toBe(1)
  })

  it('u_func_call nested in expression gets extraState', async () => {
    const code = 'double x1 = (-b + sqrt(b * b - 4 * a * c)) / (2 * a);'
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)

    // Find the u_func_call block in the nested tree
    const funcCall = findBlockByType(topBlocks[0], 'u_func_call')
    expect(funcCall).not.toBeNull()
    expect(funcCall?.fields?.NAME).toBe('sqrt')
    expect(funcCall?.extraState?.argCount).toBe(1)
  })

  it('full quadratic formula program converts without error', async () => {
    const code = [
      '#include <iostream>',
      '#include <cmath>',
      'using namespace std;',
      '',
      'int main() {',
      '    double a, b, c;',
      '    cin >> a >> b >> c;',
      '    double x1 = (-b + sqrt(b * b - 4 * a * c)) / (2 * a);',
      '    double x2 = (-b - sqrt(b * b - 4 * a * c)) / (2 * a);',
      '    cout << x1 << endl;',
      '    cout << x2 << endl;',
      '    return 0;',
      '}',
    ].join('\n')
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)
    expect(topBlocks.length).toBeGreaterThan(0)

    // Verify no c_raw_expression blocks in the tree
    const checkNoRawExpr = (block: BlockJSON) => {
      expect(block.type).not.toBe('c_raw_expression')
      if (block.inputs) {
        for (const val of Object.values(block.inputs)) {
          checkNoRawExpr(val.block)
        }
      }
      if (block.next) checkNoRawExpr(block.next.block)
    }
    checkNoRawExpr(topBlocks[0])
  })

  describe('operator precedence parenthesization', () => {
    // Helper to build a nested arithmetic block
    function arithBlock(op: string, a: BlockJSON, b: BlockJSON): BlockJSON {
      return { type: 'u_arithmetic', id: 'test', fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } }
    }
    function varBlock(name: string): BlockJSON {
      return { type: 'u_var_ref', id: 'test', fields: { NAME: name } }
    }
    function numBlock(n: number): BlockJSON {
      return { type: 'u_number', id: 'test', fields: { NUM: n } }
    }

    it('(a + b) * c → adds parens for lower precedence left child', () => {
      // * { A: + { A: a, B: b }, B: c }
      const block = arithBlock('*', arithBlock('+', varBlock('a'), varBlock('b')), varBlock('c'))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('(a + b) * c')
    })

    it('a * b + c → no parens needed', () => {
      const block = arithBlock('+', arithBlock('*', varBlock('a'), varBlock('b')), varBlock('c'))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('a * b + c')
    })

    it('a - (b + c) → adds parens for right child with same precedence group', () => {
      const block = arithBlock('-', varBlock('a'), arithBlock('+', varBlock('b'), varBlock('c')))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('a - (b + c)')
    })

    it('a * b / c → no parens for left child with same precedence', () => {
      // / { A: * { A: a, B: b }, B: c }
      const block = arithBlock('/', arithBlock('*', varBlock('a'), varBlock('b')), varBlock('c'))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('a * b / c')
    })

    it('a / (b * c) → adds parens for right child with same precedence', () => {
      const block = arithBlock('/', varBlock('a'), arithBlock('*', varBlock('b'), varBlock('c')))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('a / (b * c)')
    })

    it('(a + b) > (c - d) → adds parens for arithmetic inside comparison', () => {
      const block: BlockJSON = {
        type: 'u_compare', id: 'test', fields: { OP: '>' },
        inputs: {
          A: { block: arithBlock('+', varBlock('a'), varBlock('b')) },
          B: { block: arithBlock('-', varBlock('c'), varBlock('d')) },
        },
      }
      // compare has order 10, arithmetic + has order 12 which is > 10
      // so no parens needed (higher order = higher precedence)
      const code = adapter.generateCode('u_compare', block, 0)
      expect(code).toBe('a + b > c - d')
    })

    it('(a > b) && (c < d) → no parens for higher prec inside logic', () => {
      const block: BlockJSON = {
        type: 'u_logic', id: 'test', fields: { OP: '&&' },
        inputs: {
          A: { block: { type: 'u_compare', id: 't', fields: { OP: '>' }, inputs: { A: { block: varBlock('a') }, B: { block: varBlock('b') } } } },
          B: { block: { type: 'u_compare', id: 't', fields: { OP: '<' }, inputs: { A: { block: varBlock('c') }, B: { block: varBlock('d') } } } },
        },
      }
      const code = adapter.generateCode('u_logic', block, 0)
      expect(code).toBe('a > b && c < d')
    })

    it('quadratic: (-b + sqrt(...)) / (2 * a) generates correct parens', () => {
      // (-b + sqrt(x)) / (2 * a) → (-b + sqrt(x)) / (2 * a)
      const sqrtBlock: BlockJSON = {
        type: 'u_func_call', id: 't', fields: { NAME: 'sqrt' },
        inputs: { ARG0: { block: varBlock('x') } },
        extraState: { argCount: 1 },
      }
      const negB = arithBlock('-', numBlock(0), varBlock('b'))
      const numerator = arithBlock('+', negB, sqrtBlock)
      const denominator = arithBlock('*', numBlock(2), varBlock('a'))
      const block = arithBlock('/', numerator, denominator)
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('(-b + sqrt(x)) / (2 * a)')
    })

    it('unary minus: -b → generates -b (not 0 - b)', () => {
      const block = arithBlock('-', numBlock(0), varBlock('b'))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('-b')
    })

    it('unary minus with complex operand: -(a + b) → adds parens', () => {
      const block = arithBlock('-', numBlock(0), arithBlock('+', varBlock('a'), varBlock('b')))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('-(a + b)')
    })

    it('unary minus in multiplication: -a * b → no parens (higher precedence)', () => {
      const negA = arithBlock('-', numBlock(0), varBlock('a'))
      const block = arithBlock('*', negA, varBlock('b'))
      const code = adapter.generateCode('u_arithmetic', block, 0)
      expect(code).toBe('-a * b')
    })
  })

  it('u_input with multiple vars gets extraState.varCount', async () => {
    const code = [
      'int main() {',
      '    cin >> a >> b >> c;',
      '    return 0;',
      '}',
    ].join('\n')
    const blocks = await converter.convert(code)
    const topBlocks = getTopBlocks(blocks)
    // Find u_input in the nested block tree
    const inputBlock = findBlockByType(topBlocks[0], 'u_input')
    expect(inputBlock).not.toBeNull()
    expect(inputBlock?.extraState?.varCount).toBe(3)
  })
})
