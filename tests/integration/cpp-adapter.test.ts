import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import { createNode, nodeEquals } from '../../src/core/semantic-model'
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

// ==========================================================
// T009-T011: SemanticNode adapter tests
// ==========================================================

describe('T009: toSemanticNode — CST → SemanticNode', () => {
  it('should convert translation_unit to program node', async () => {
    const tree = await parser.parse('int x = 5;')
    const sem = adapter.toSemanticNode(tree.rootNode)
    expect(sem).not.toBeNull()
    expect(sem!.concept).toBe('program')
    expect(Array.isArray(sem!.children.body)).toBe(true)
  })

  it('should convert var_declare with initializer', async () => {
    const tree = await parser.parse('int x = 42;')
    const sem = adapter.toSemanticNode(tree.rootNode)
    const body = sem!.children.body as any[]
    const decl = body[0]
    expect(decl.concept).toBe('var_declare')
    expect(decl.properties.name).toBe('x')
    expect(decl.properties.type).toBe('int')
    expect(decl.children.initializer).toBeDefined()
    expect(decl.children.initializer.concept).toBe('number_literal')
    expect(decl.children.initializer.properties.value).toBe('42')
  })

  it('should convert binary expressions to arithmetic/compare/logic', async () => {
    const node = await parseAndGetNode('int x = 3 + 5;', 'binary_expression')
    const sem = adapter.toSemanticNode(node)
    expect(sem).not.toBeNull()
    expect(sem!.concept).toBe('arithmetic')
    expect(sem!.properties.operator).toBe('+')
    expect(sem!.children.left).toBeDefined()
    expect(sem!.children.right).toBeDefined()
  })

  it('should convert if_statement to if concept', async () => {
    const node = await parseAndGetNode('void f() { if (x > 0) { int a = 1; } }', 'if_statement')
    const sem = adapter.toSemanticNode(node)
    expect(sem).not.toBeNull()
    expect(sem!.concept).toBe('if')
    expect(sem!.children.condition).toBeDefined()
    expect(Array.isArray(sem!.children.then_body)).toBe(true)
  })

  it('should convert if-else to if concept with else_body', async () => {
    const node = await parseAndGetNode('void f() { if (x) { int a = 1; } else { int b = 2; } }', 'if_statement')
    const sem = adapter.toSemanticNode(node)
    expect(sem!.concept).toBe('if')
    expect(sem!.children.else_body).toBeDefined()
    expect(Array.isArray(sem!.children.else_body)).toBe(true)
  })

  it('should convert counting for loop to count_loop', async () => {
    const node = await parseAndGetNode('void f() { for (int i = 0; i < 10; i++) { break; } }', 'for_statement')
    const sem = adapter.toSemanticNode(node)
    expect(sem!.concept).toBe('count_loop')
    expect(sem!.properties.var_name).toBe('i')
    expect(sem!.children.from).toBeDefined()
    expect(sem!.children.to).toBeDefined()
    expect(Array.isArray(sem!.children.body)).toBe(true)
  })

  it('should convert function definition', async () => {
    const node = await parseAndGetNode('int add(int a, int b) { return a + b; }', 'function_definition')
    const sem = adapter.toSemanticNode(node)
    expect(sem!.concept).toBe('func_def')
    expect(sem!.properties.name).toBe('add')
    expect(sem!.properties.return_type).toBe('int')
    const params = JSON.parse(sem!.properties.params as string)
    expect(params).toEqual([{ type: 'int', name: 'a' }, { type: 'int', name: 'b' }])
    expect(Array.isArray(sem!.children.body)).toBe(true)
  })

  it('should convert cout to print with values', async () => {
    const node = await parseAndGetNode('void f() { cout << 42 << endl; }', 'binary_expression')
    // Find the outermost << expression (the full cout statement)
    const tree = await parser.parse('void f() { cout << 42 << endl; }')
    const funcBody = tree.rootNode.namedChildren[0] // function_definition
    const compoundStmt = funcBody.childForFieldName('body')!
    const exprStmt = compoundStmt.namedChildren[0] // expression_statement
    const coutExpr = exprStmt.namedChildren[0] // the binary_expression
    const sem = adapter.toSemanticNode(coutExpr)
    expect(sem!.concept).toBe('print')
    const values = sem!.children.values as any[]
    expect(values.length).toBe(2)
    expect(values[0].concept).toBe('number_literal')
    expect(values[1].concept).toBe('endl')
  })

  it('should convert cin to input with variable', async () => {
    const tree = await parser.parse('void f() { cin >> x >> y; }')
    const funcBody = tree.rootNode.namedChildren[0]
    const compoundStmt = funcBody.childForFieldName('body')!
    const exprStmt = compoundStmt.namedChildren[0]
    const cinExpr = exprStmt.namedChildren[0]
    const sem = adapter.toSemanticNode(cinExpr)
    expect(sem!.concept).toBe('input')
    expect(sem!.properties.variable).toBe('x,y')
  })

  it('should convert preproc_include to cpp:include', async () => {
    const node = await parseAndGetNode('#include <iostream>', 'preproc_include')
    const sem = adapter.toSemanticNode(node)
    expect(sem!.concept).toBe('cpp:include')
    expect(sem!.properties.header).toBe('iostream')
  })
})

describe('T010: toBlockJSON — SemanticNode → BlockJSON', () => {
  it('should convert var_declare to u_var_declare block', () => {

    const init = createNode('number_literal', { value: '42' })
    const node = createNode('var_declare', { name: 'x', type: 'int' }, { initializer: init })
    const block = adapter.toBlockJSON(node) as any
    expect(block.type).toBe('u_var_declare')
    expect(block.fields.NAME).toBe('x')
    expect(block.fields.TYPE).toBe('int')
    expect(block.inputs.INIT.block.type).toBe('u_number')
    expect(block.inputs.INIT.block.fields.NUM).toBe('42')
  })

  it('should convert if with else_body to u_if_else', () => {

    const cond = createNode('compare', { operator: '>' }, {
      left: createNode('var_ref', { name: 'x' }),
      right: createNode('number_literal', { value: '0' }),
    })
    const node = createNode('if', {}, {
      condition: cond,
      then_body: [createNode('break')],
      else_body: [createNode('continue')],
    })
    const block = adapter.toBlockJSON(node) as any
    expect(block.type).toBe('u_if_else')
    expect(block.inputs.COND).toBeDefined()
    expect(block.inputs.THEN).toBeDefined()
    expect(block.inputs.ELSE).toBeDefined()
  })

  it('should convert func_def with params', () => {

    const ret = createNode('return', {}, { value: createNode('number_literal', { value: '0' }) })
    const node = createNode('func_def', {
      name: 'main',
      return_type: 'int',
      params: '[]',
    }, { body: [ret] })
    const block = adapter.toBlockJSON(node) as any
    expect(block.type).toBe('u_func_def')
    expect(block.fields.NAME).toBe('main')
    expect(block.fields.RETURN_TYPE).toBe('int')
    expect(block.inputs.BODY).toBeDefined()
  })

  it('should convert print with values to u_print with numbered EXPR inputs', () => {

    const node = createNode('print', {}, {
      values: [
        createNode('number_literal', { value: '42' }),
        createNode('endl'),
      ],
    })
    const block = adapter.toBlockJSON(node) as any
    expect(block.type).toBe('u_print')
    expect(block.inputs.EXPR0.block.type).toBe('u_number')
    expect(block.inputs.EXPR1.block.type).toBe('u_endl')
  })
})

describe('T011: fromBlockJSON — BlockJSON → SemanticNode', () => {
  it('should convert u_var_declare to var_declare', () => {
    const block = {
      type: 'u_var_declare',
      id: 'test1',
      fields: { NAME: 'x', TYPE: 'int', INIT_MODE: 'with_init' },
      inputs: { INIT: { block: { type: 'u_number', id: 'test2', fields: { NUM: '42' } } } },
    }
    const sem = adapter.fromBlockJSON(block)
    expect(sem).not.toBeNull()
    expect(sem!.concept).toBe('var_declare')
    expect(sem!.properties.name).toBe('x')
    expect(sem!.properties.type).toBe('int')
    expect(sem!.children.initializer).toBeDefined()
    const init = sem!.children.initializer as any
    expect(init.concept).toBe('number_literal')
    expect(init.properties.value).toBe('42')
  })

  it('should convert u_if_else to if concept with else_body', () => {
    const block = {
      type: 'u_if_else',
      id: 'test3',
      inputs: {
        COND: { block: { type: 'u_compare', id: 'c1', fields: { OP: '>' },
          inputs: {
            A: { block: { type: 'u_var_ref', id: 'v1', fields: { NAME: 'x' } } },
            B: { block: { type: 'u_number', id: 'n1', fields: { NUM: '0' } } },
          } } },
        THEN: { block: { type: 'u_break', id: 'b1' } },
        ELSE: { block: { type: 'u_continue', id: 'c2' } },
      },
    }
    const sem = adapter.fromBlockJSON(block)
    expect(sem!.concept).toBe('if')
    expect(sem!.children.condition).toBeDefined()
    expect(Array.isArray(sem!.children.then_body)).toBe(true)
    expect(Array.isArray(sem!.children.else_body)).toBe(true)
  })

  it('should roundtrip: SemanticNode → BlockJSON → SemanticNode', () => {

    const original = createNode('var_declare', { name: 'y', type: 'double' }, {
      initializer: createNode('number_literal', { value: '3.14' }),
    })
    const blockJson = adapter.toBlockJSON(original)
    const restored = adapter.fromBlockJSON(blockJson)
    expect(restored).not.toBeNull()
    expect(nodeEquals(original, restored!)).toBe(true)
  })

  it('should roundtrip func_call with args', () => {

    const original = createNode('func_call', { name: 'add' }, {
      args: [
        createNode('number_literal', { value: '1' }),
        createNode('var_ref', { name: 'x' }),
      ],
    })
    const blockJson = adapter.toBlockJSON(original)
    const restored = adapter.fromBlockJSON(blockJson)
    expect(nodeEquals(original, restored!)).toBe(true)
  })

  it('should return null for unknown block types', () => {
    const block = { type: 'c_raw_expression', id: 'test', fields: { CODE: 'foo' } }
    const sem = adapter.fromBlockJSON(block)
    expect(sem).toBeNull()
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
