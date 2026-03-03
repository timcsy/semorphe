import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { Node } from 'web-tree-sitter'

/**
 * T009: Integration tests for CppAdapter.matchNodeToBlock
 * T010: Integration tests for CppAdapter.extractFields
 *
 * These tests verify the adapter maps C++ AST nodes to universal block IDs
 * and extracts the correct fields for each block type.
 */

let parser: CppParser
let adapter: CppLanguageAdapter

async function parseAndGetNode(code: string, nodeType: string): Promise<Node> {
  const tree = await parser.parse(code)
  const found = findNodeByType(tree.rootNode, nodeType)
  if (!found) throw new Error(`Node type "${nodeType}" not found in: ${code}`)
  return found
}

function findNodeByType(node: Node, type: string): Node | null {
  if (node.type === type) return node
  for (const child of node.namedChildren) {
    const found = findNodeByType(child, type)
    if (found) return found
  }
  return null
}

function findAllNodesByType(node: Node, type: string): Node[] {
  const results: Node[] = []
  if (node.type === type) results.push(node)
  for (const child of node.namedChildren) {
    results.push(...findAllNodesByType(child, type))
  }
  return results
}

beforeAll(async () => {
  parser = new CppParser()
  await parser.init()
  adapter = new CppLanguageAdapter()
})

describe('T009: CppAdapter.matchNodeToBlock', () => {
  describe('計數式 for 迴圈 → u_count_loop', () => {
    it('should match standard counting for-loop', async () => {
      const node = await parseAndGetNode('void f() { for (int i = 0; i < 10; i++) {} }', 'for_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_count_loop')
    })

    it('should match counting for-loop with <= operator', async () => {
      const node = await parseAndGetNode('void f() { for (int i = 0; i <= 9; i++) {} }', 'for_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_count_loop')
    })
  })

  describe('if 條件判斷', () => {
    it('should match if without else → u_if', async () => {
      const node = await parseAndGetNode('void f() { if (x > 0) { } }', 'if_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_if')
    })

    it('should match if with else → u_if_else', async () => {
      const node = await parseAndGetNode('void f() { if (x > 0) { } else { } }', 'if_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_if_else')
    })
  })

  describe('while 迴圈 → u_while_loop', () => {
    it('should match while loop', async () => {
      const node = await parseAndGetNode('void f() { while (x > 0) { } }', 'while_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_while_loop')
    })
  })

  describe('變數宣告 → u_var_declare', () => {
    it('should match variable declaration with init', async () => {
      const node = await parseAndGetNode('int x = 5;', 'declaration')
      expect(adapter.matchNodeToBlock(node)).toBe('u_var_declare')
    })
  })

  describe('變數賦值 → u_var_assign', () => {
    it('should match assignment expression', async () => {
      const node = await parseAndGetNode('void f() { x = 10; }', 'assignment_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_var_assign')
    })
  })

  describe('算術運算 → u_arithmetic', () => {
    it('should match addition', async () => {
      const node = await parseAndGetNode('void f() { int y = a + b; }', 'binary_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_arithmetic')
    })
  })

  describe('比較運算 → u_compare', () => {
    it('should match comparison', async () => {
      const node = await parseAndGetNode('void f() { if (x > 0) {} }', 'binary_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_compare')
    })
  })

  describe('邏輯運算 → u_logic', () => {
    it('should match logical AND', async () => {
      const node = await parseAndGetNode('void f() { if (a && b) {} }', 'binary_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_logic')
    })
  })

  describe('邏輯否定 → u_logic_not', () => {
    it('should match logical NOT', async () => {
      const node = await parseAndGetNode('void f() { if (!x) {} }', 'unary_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_logic_not')
    })
  })

  describe('函式定義 → u_func_def', () => {
    it('should match function definition', async () => {
      const node = await parseAndGetNode('int main() { return 0; }', 'function_definition')
      expect(adapter.matchNodeToBlock(node)).toBe('u_func_def')
    })
  })

  describe('函式呼叫 → u_func_call', () => {
    it('should match generic function call', async () => {
      const node = await parseAndGetNode('void f() { myFunc(1, 2); }', 'call_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_func_call')
    })
  })

  describe('return → u_return', () => {
    it('should match return statement', async () => {
      const node = await parseAndGetNode('int f() { return 0; }', 'return_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_return')
    })
  })

  describe('break/continue', () => {
    it('should match break → u_break', async () => {
      const node = await parseAndGetNode('void f() { while(1) { break; } }', 'break_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_break')
    })

    it('should match continue → u_continue', async () => {
      const node = await parseAndGetNode('void f() { while(1) { continue; } }', 'continue_statement')
      expect(adapter.matchNodeToBlock(node)).toBe('u_continue')
    })
  })

  describe('字面值', () => {
    it('should match number literal → u_number', async () => {
      const node = await parseAndGetNode('void f() { int x = 42; }', 'number_literal')
      expect(adapter.matchNodeToBlock(node)).toBe('u_number')
    })

    it('should match identifier → u_var_ref', async () => {
      // identifier in expression context (e.g., rhs of assignment)
      const tree = await parser.parse('void f() { int y = x; }')
      const decl = findNodeByType(tree.rootNode, 'declaration')!
      // find the identifier that is the value (not the declarator name)
      const initDecl = findNodeByType(decl, 'init_declarator')!
      const valueNode = initDecl.childForFieldName('value')!
      expect(adapter.matchNodeToBlock(valueNode)).toBe('u_var_ref')
    })

    it('should match string literal → u_string', async () => {
      const node = await parseAndGetNode('void f() { const char* s = "hello"; }', 'string_literal')
      expect(adapter.matchNodeToBlock(node)).toBe('u_string')
    })
  })

  describe('陣列', () => {
    it('should match subscript expression → u_array_access', async () => {
      const node = await parseAndGetNode('void f() { int x = arr[0]; }', 'subscript_expression')
      expect(adapter.matchNodeToBlock(node)).toBe('u_array_access')
    })
  })

  describe('cout/cin', () => {
    it('should match cout << → u_print', async () => {
      const tree = await parser.parse('void f() { cout << x << endl; }')
      // cout << ... is a nested binary_expression with <<
      const binExprs = findAllNodesByType(tree.rootNode, 'binary_expression')
      // The outermost << expression is the print
      const coutExpr = binExprs.find(n => {
        const left = n.childForFieldName('left')
        if (!left) return false
        // Check if leftmost identifier is cout
        return findLeftmost(left) === 'cout'
      })
      expect(coutExpr).toBeDefined()
      expect(adapter.matchNodeToBlock(coutExpr!)).toBe('u_print')
    })

    it('should match cin >> → u_input', async () => {
      const tree = await parser.parse('void f() { cin >> x; }')
      const binExprs = findAllNodesByType(tree.rootNode, 'binary_expression')
      const cinExpr = binExprs.find(n => {
        const left = n.childForFieldName('left')
        return left?.text === 'cin'
      })
      expect(cinExpr).toBeDefined()
      expect(adapter.matchNodeToBlock(cinExpr!)).toBe('u_input')
    })
  })

  describe('C++ 特殊積木 (fallback to language-specific)', () => {
    it('should return null for #include (handled by C++ specific block)', async () => {
      const node = await parseAndGetNode('#include <stdio.h>', 'preproc_include')
      // #include is language-specific, adapter returns null so converter falls back to registry
      const result = adapter.matchNodeToBlock(node)
      expect(result).toBeNull()
    })
  })
})

describe('T010: CppAdapter.extractFields', () => {
  describe('u_count_loop 欄位萃取', () => {
    it('should extract VAR, FROM, TO from counting for-loop', async () => {
      const node = await parseAndGetNode('void f() { for (int i = 0; i < 10; i++) {} }', 'for_statement')
      const { fields, inputs } = adapter.extractFields(node, 'u_count_loop')
      expect(fields.VAR).toBe('i')
      expect(inputs.FROM).toBeDefined()
      expect(inputs.TO).toBeDefined()
    })

    it('should extract TO from counting for-loop with <= operator', async () => {
      const node = await parseAndGetNode('void f() { for (int i = 0; i <= 9; i++) {} }', 'for_statement')
      const { fields, inputs } = adapter.extractFields(node, 'u_count_loop')
      expect(fields.VAR).toBe('i')
      expect(inputs.FROM).toBeDefined()
      expect(inputs.TO).toBeDefined()
    })
  })

  describe('u_if 欄位萃取', () => {
    it('should extract COND from if statement', async () => {
      const node = await parseAndGetNode('void f() { if (x > 0) { } }', 'if_statement')
      const { inputs } = adapter.extractFields(node, 'u_if')
      expect(inputs.COND).toBeDefined()
    })
  })

  describe('u_var_declare 欄位萃取（含 INIT_MODE）', () => {
    it('should extract INIT_MODE=with_init for initialized declaration', async () => {
      const node = await parseAndGetNode('int x = 5;', 'declaration')
      const { fields, inputs } = adapter.extractFields(node, 'u_var_declare')
      expect(fields.TYPE).toBe('int')
      expect(fields.NAME).toBe('x')
      expect(fields.INIT_MODE).toBe('with_init')
      expect(inputs.INIT).toBeDefined()
    })

    it('should extract INIT_MODE=no_init for uninitialized declaration', async () => {
      const node = await parseAndGetNode('int x;', 'declaration')
      const { fields } = adapter.extractFields(node, 'u_var_declare')
      expect(fields.TYPE).toBe('int')
      expect(fields.NAME).toBe('x')
      expect(fields.INIT_MODE).toBe('no_init')
    })
  })

  describe('u_func_def 欄位萃取（動態參數）', () => {
    it('should extract dynamic params TYPE_N/PARAM_N from function definition', async () => {
      const node = await parseAndGetNode('int add(int a, int b) { return 0; }', 'function_definition')
      const { fields } = adapter.extractFields(node, 'u_func_def')
      expect(fields.NAME).toBe('add')
      expect(fields.RETURN_TYPE).toBe('int')
      expect(fields.TYPE_0).toBe('int')
      expect(fields.PARAM_0).toBe('a')
      expect(fields.TYPE_1).toBe('int')
      expect(fields.PARAM_1).toBe('b')
    })

    it('should extract 0 params for void f()', async () => {
      const node = await parseAndGetNode('void f() {}', 'function_definition')
      const { fields } = adapter.extractFields(node, 'u_func_def')
      expect(fields.NAME).toBe('f')
      expect(fields.RETURN_TYPE).toBe('void')
      expect(fields.TYPE_0).toBeUndefined()
    })
  })

  describe('u_func_call 欄位萃取（動態引數）', () => {
    it('should extract dynamic args ARG0/ARG1 from call expression', async () => {
      const node = await parseAndGetNode('void f() { add(x, y); }', 'call_expression')
      const { fields, inputs } = adapter.extractFields(node, 'u_func_call')
      expect(fields.NAME).toBe('add')
      expect(inputs.ARG0).toBeDefined()
      expect(inputs.ARG1).toBeDefined()
    })

    it('should extract 0 args for func()', async () => {
      const node = await parseAndGetNode('void f() { func(); }', 'call_expression')
      const { fields, inputs } = adapter.extractFields(node, 'u_func_call')
      expect(fields.NAME).toBe('func')
      expect(inputs.ARG0).toBeUndefined()
    })
  })

  describe('u_input 欄位萃取（多變數）', () => {
    it('should extract NAME_0, NAME_1, NAME_2 from cin >> a >> b >> c', async () => {
      const tree = await parser.parse('void f() { cin >> a >> b >> c; }')
      const binExprs = findAllNodesByType(tree.rootNode, 'binary_expression')
      // Find the outermost cin >> ... expression
      const cinExpr = binExprs.find(n => {
        const left = n.childForFieldName('left')
        return left ? findLeftmost(left) === 'cin' : false
      })
      expect(cinExpr).toBeDefined()
      const { fields } = adapter.extractFields(cinExpr!, 'u_input')
      expect(fields.NAME_0).toBe('a')
      expect(fields.NAME_1).toBe('b')
      expect(fields.NAME_2).toBe('c')
    })

    it('should extract NAME_0 from cin >> x (single var)', async () => {
      const tree = await parser.parse('void f() { cin >> x; }')
      const binExprs = findAllNodesByType(tree.rootNode, 'binary_expression')
      const cinExpr = binExprs.find(n => {
        const left = n.childForFieldName('left')
        return left?.text === 'cin'
      })
      expect(cinExpr).toBeDefined()
      const { fields } = adapter.extractFields(cinExpr!, 'u_input')
      expect(fields.NAME_0).toBe('x')
    })
  })

  describe('u_return 欄位萃取', () => {
    it('should extract VALUE from return statement', async () => {
      const node = await parseAndGetNode('int f() { return 42; }', 'return_statement')
      const { inputs } = adapter.extractFields(node, 'u_return')
      expect(inputs.VALUE).toBeDefined()
    })
  })

  describe('u_arithmetic 欄位萃取', () => {
    it('should extract A, OP, B from binary expression', async () => {
      const node = await parseAndGetNode('void f() { int y = a + b; }', 'binary_expression')
      const { fields, inputs } = adapter.extractFields(node, 'u_arithmetic')
      expect(fields.OP).toBe('+')
      expect(inputs.A).toBeDefined()
      expect(inputs.B).toBeDefined()
    })
  })

  describe('u_var_assign 欄位萃取', () => {
    it('should extract NAME, VALUE from assignment', async () => {
      const node = await parseAndGetNode('void f() { x = 10; }', 'assignment_expression')
      const { fields, inputs } = adapter.extractFields(node, 'u_var_assign')
      expect(fields.NAME).toBe('x')
      expect(inputs.VALUE).toBeDefined()
    })
  })
})

describe('T018: Full integration — C++ code → concept blocks + SourceMapping', () => {
  let registry: BlockRegistry
  let converter: CodeToBlocksConverter

  beforeAll(async () => {
    const { BlockRegistry: BR } = await import('../../src/core/block-registry')
    const { CodeToBlocksConverter: C2B } = await import('../../src/core/code-to-blocks')
    const basicBlocks = (await import('../../src/languages/cpp/blocks/basic.json')).default
    const specialBlocks = (await import('../../src/languages/cpp/blocks/special.json')).default
    const advancedBlocks = (await import('../../src/languages/cpp/blocks/advanced.json')).default
    const universalBlocks = (await import('../../src/blocks/universal.json')).default

    registry = new BR()
    for (const spec of [...universalBlocks, ...basicBlocks, ...specialBlocks, ...advancedBlocks] as any[]) {
      registry.register(spec)
    }

    converter = new C2B(registry, parser, adapter)
  })

  it('should convert for/if/return program to concept blocks', async () => {
    const code = `
int main() {
    for (int i = 0; i < 10; i++) {
        if (i > 5) {
            break;
        }
    }
    return 0;
}
`
    const { workspace, mappings } = await converter.convertWithMappings(code)
    const blocks = workspace.blocks.blocks

    expect(blocks.length).toBeGreaterThan(0)

    // Should produce concept blocks (u_* prefix)
    const allBlocks = flattenBlocks(blocks)
    const blockTypes = allBlocks.map((b: any) => b.type)

    // function definition should be present
    expect(blockTypes).toContain('u_func_def')
    // for loop as counting loop
    expect(blockTypes).toContain('u_count_loop')
    // if statement
    expect(blockTypes).toContain('u_if')
    // break
    expect(blockTypes).toContain('u_break')
    // return
    expect(blockTypes).toContain('u_return')
  })

  it('should generate SourceMappings for converted blocks', async () => {
    const code = `int x = 5;`
    const { mappings } = await converter.convertWithMappings(code)

    expect(mappings.length).toBeGreaterThan(0)
    expect(mappings[0]).toHaveProperty('blockId')
    expect(mappings[0]).toHaveProperty('startLine')
    expect(mappings[0]).toHaveProperty('endLine')
  })

  it('should convert cout to u_print with numbered expression inputs', async () => {
    const code = `
void f() {
    cout << 42 << endl;
}
`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    const printBlock = allBlocks.find((b: any) => b.type === 'u_print')
    expect(printBlock).toBeDefined()
    expect(printBlock.inputs.EXPR0.block.type).toBe('u_number')
    expect(printBlock.inputs.EXPR1.block.type).toBe('u_endl')
  })

  it('should convert cout without endl to u_print without u_endl block', async () => {
    const code = `
void f() {
    cout << 42;
}
`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    const printBlock = allBlocks.find((b: any) => b.type === 'u_print')
    expect(printBlock).toBeDefined()
    expect(printBlock.inputs.EXPR0.block.type).toBe('u_number')
    expect(printBlock.inputs.EXPR1).toBeUndefined()
  })

  it('should handle cout with multiple << values as separate inputs', async () => {
    const code = `
void f() {
    cout << "i = " << i << endl;
}
`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    const printBlock = allBlocks.find((b: any) => b.type === 'u_print')
    expect(printBlock).toBeDefined()
    // Multiple values should be separate numbered inputs
    expect(printBlock.inputs.EXPR0).toBeDefined()
    expect(printBlock.inputs.EXPR1).toBeDefined()
    expect(printBlock.inputs.EXPR2.block.type).toBe('u_endl')
    expect(printBlock.extraState).toEqual({ itemCount: 3 })
  })

  it('should fall back to C++ specific blocks for #include', async () => {
    const code = `#include <iostream>`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    // #include should use C++ specific block (c_include)
    const includeBlock = allBlocks.find((b: any) => b.type === 'c_include')
    expect(includeBlock).toBeDefined()
  })
})

describe('T029: C++ special block conversion — fallback to registry', () => {
  let registry: BlockRegistry
  let converter: CodeToBlocksConverter

  beforeAll(async () => {
    const basicBlocks = (await import('../../src/languages/cpp/blocks/basic.json')).default
    const specialBlocks = (await import('../../src/languages/cpp/blocks/special.json')).default
    const advancedBlocks = (await import('../../src/languages/cpp/blocks/advanced.json')).default
    const universalBlocks = (await import('../../src/blocks/universal.json')).default

    registry = new BlockRegistry()
    for (const spec of [...universalBlocks, ...basicBlocks, ...specialBlocks, ...advancedBlocks] as any[]) {
      registry.register(spec)
    }
    converter = new CodeToBlocksConverter(registry, parser, adapter)
  })

  it('non-counting for_statement → c_for_loop (三段式 for)', async () => {
    // for (i = 0; i < 10; i += 2) is NOT counting (update is += 2, not ++)
    const code = `void f() { for (;;) { break; } }`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    // Non-counting for should fall back to c_for_loop
    expect(allBlocks.some((b: any) => b.type === 'c_for_loop')).toBe(true)
  })

  it('do_statement → c_do_while', async () => {
    const code = `void f() { do { break; } while (1); }`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'c_do_while')).toBe(true)
  })

  it('switch_statement → c_switch', async () => {
    const code = `void f() { switch (x) { case 1: break; } }`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'c_switch')).toBe(true)
  })

  it('printf call → c_printf', async () => {
    const code = `void f() { printf("%d\\n", x); }`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'c_printf')).toBe(true)
  })

  it('scanf call → c_scanf', async () => {
    const code = `void f() { scanf("%d", &x); }`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'c_scanf')).toBe(true)
  })
})

describe('T033: Mixed universal + special blocks roundtrip', () => {
  let registry: BlockRegistry
  let converter: CodeToBlocksConverter

  beforeAll(async () => {
    const basicBlocks = (await import('../../src/languages/cpp/blocks/basic.json')).default
    const specialBlocks = (await import('../../src/languages/cpp/blocks/special.json')).default
    const advancedBlocks = (await import('../../src/languages/cpp/blocks/advanced.json')).default
    const universalBlocks = (await import('../../src/blocks/universal.json')).default

    registry = new BlockRegistry()
    for (const spec of [...universalBlocks, ...basicBlocks, ...specialBlocks, ...advancedBlocks] as any[]) {
      registry.register(spec)
    }
    converter = new CodeToBlocksConverter(registry, parser, adapter)
  })

  it('mixed: counting for + printf inside → u_count_loop + c_printf', async () => {
    const code = `
void f() {
    for (int i = 0; i < 10; i++) {
        printf("%d\\n", i);
    }
}
`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    const types = allBlocks.map((b: any) => b.type)
    expect(types).toContain('u_func_def')
    expect(types).toContain('u_count_loop')
    expect(types).toContain('c_printf')
  })

  it('mixed: if-else with cout and return → u_if_else + u_print + u_return', async () => {
    const code = `
int main() {
    int x = 5;
    if (x > 0) {
        cout << x << endl;
    } else {
        return 0;
    }
}
`
    const { workspace } = await converter.convertWithMappings(code)
    const allBlocks = flattenBlocks(workspace.blocks.blocks)
    const types = allBlocks.map((b: any) => b.type)
    expect(types).toContain('u_func_def')
    expect(types).toContain('u_var_declare')
    expect(types).toContain('u_if_else')
    expect(types).toContain('u_print')
    expect(types).toContain('u_return')
  })
})

// Helpers
function findLeftmost(node: Node): string | null {
  if (node.type === 'identifier') return node.text
  const left = node.childForFieldName('left')
  if (left) return findLeftmost(left)
  return node.text
}

function flattenBlocks(blocks: any[]): any[] {
  const result: any[] = []
  for (const block of blocks) {
    result.push(block)
    if (block.inputs) {
      for (const input of Object.values(block.inputs) as any[]) {
        if (input.block) result.push(...flattenBlocks([input.block]))
      }
    }
    if (block.next?.block) {
      result.push(...flattenBlocks([block.next.block]))
    }
  }
  return result
}
