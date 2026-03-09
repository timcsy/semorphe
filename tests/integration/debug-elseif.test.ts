import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
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

describe('if-else-if round-trip', () => {
  it('code → semantic → code preserves else-if chain', () => {
    const code = 'if (D > 0) { int x = 1; } else if (D == 0) { int y = 2; } else { int z = 3; }'
    const result = liftCode(code)
    const generated = generateCode(result!, 'cpp', style)
    expect(generated).toContain('else if')
    expect(generated).not.toMatch(/else\s*\{\s*\n\s*if/)
  })

  it('code → semantic → blocks flattens else-if into ELSEIF inputs', () => {
    const code = 'if (D > 0) { int x = 1; } else if (D == 0) { int y = 2; } else { int z = 3; }'
    const result = liftCode(code)
    const state = renderToBlocklyState(result!)
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_if')
    expect(block.inputs['ELSEIF_CONDITION_0']).toBeDefined()
    expect(block.inputs['ELSEIF_THEN_0']).toBeDefined()
    expect(block.inputs['ELSE']).toBeDefined()
    expect(block.extraState).toEqual({ elseifCount: 1, hasElse: true })
  })

  it('quadratic formula with parentheses and else-if', () => {
    const code = `
#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double a, b, c;
    cin >> a >> b >> c;
    double D = b * b - 4 * a * c;
    if (D > 0) {
        double x1 = (-b + sqrt(D)) / (2 * a);
        double x2 = (-b - sqrt(D)) / (2 * a);
        cout << "x1 = " << x1 << ", x2 = " << x2 << endl;
    } else if (D == 0) {
        cout << "x = " << -b / (2 * a) << endl;
    } else {
        cout << "no answer" << endl;
    }
    return 0;
}`
    const result = liftCode(code)
    const generated = generateCode(result!, 'cpp', style)
    // else-if must be preserved
    expect(generated).toContain('else if')
    // Parentheses in arithmetic must be preserved for correct operator precedence
    expect(generated).toContain('(2 * a)')
    expect(generated).toContain('(-b + sqrt(D))')
  })

  it('truly nested else { if } stays nested in code and blocks', () => {
    const code = 'if (D > 0) { int x = 1; } else { if (D == 0) { int y = 2; } else { int z = 3; } }'
    const result = liftCode(code)

    // Inspect semantic tree
    const body = result?.children.body ?? []
    const ifNode = body[0]
    const elseBody = ifNode?.children.else_body ?? []
    console.log('nested else body[0] concept:', elseBody[0]?.concept)
    console.log('nested else body length:', elseBody.length)

    // Code generation: should produce "else { if ..." not "else if"
    const generated = generateCode(result!, 'cpp', style)
    console.log('nested generated:', generated)
    expect(generated).not.toMatch(/\} else if/)
    expect(generated).toMatch(/\} else \{/)

    // Block rendering: should NOT flatten into ELSEIF inputs
    const state = renderToBlocklyState(result!)
    const block = state.blocks.blocks[0]
    expect(block.inputs['ELSEIF_CONDITION_0']).toBeUndefined()
    expect(block.inputs['ELSE']).toBeDefined()
  })

  it('three-branch else-if chain round-trips correctly', () => {
    const code = 'if (a > 0) { int x = 1; } else if (b > 0) { int y = 2; } else if (c > 0) { int z = 3; } else { int w = 4; }'
    const result = liftCode(code)

    // Check code generation
    const generated = generateCode(result!, 'cpp', style)
    expect(generated).toContain('else if (b > 0)')
    expect(generated).toContain('else if (c > 0)')
    expect(generated).toContain('} else {')

    // Check block rendering
    const state = renderToBlocklyState(result!)
    const block = state.blocks.blocks[0]
    expect(block.inputs['ELSEIF_CONDITION_0']).toBeDefined()
    expect(block.inputs['ELSEIF_CONDITION_1']).toBeDefined()
    expect(block.extraState).toEqual({ elseifCount: 2, hasElse: true })
  })
})
