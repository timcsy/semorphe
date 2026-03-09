/**
 * Systematic Conversion Tests
 *
 * Tests the full pipeline in all directions:
 *   Code → Semantic (lift)
 *   Semantic → Blocks (render)
 *   Semantic → Code (generate)
 *   Code → Semantic → Blocks → Code (full roundtrip)
 *
 * Covers all supported C++ concepts including edge cases.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'
import type { SemanticNode } from '../../src/core/semantic-tree'

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

// ── Helpers ──

function lift(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function liftBody(code: string): SemanticNode[] {
  const program = lift(code)
  return program?.children.body ?? []
}

function liftFirst(code: string): SemanticNode | null {
  const body = liftBody(code)
  return body[0] ?? null
}

function gen(code: string): string {
  const tree = lift(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

function blocks(code: string) {
  const tree = lift(code)
  expect(tree).not.toBeNull()
  return renderToBlocklyState(tree!)
}

// ════════════════════════════════════════════
// 1. PREPROCESSOR DIRECTIVES
// ════════════════════════════════════════════

describe('Preprocessor Directives', () => {
  describe('#include', () => {
    it('lifts system include correctly', () => {
      const node = liftFirst('#include <iostream>')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_include')
      expect(node!.properties.header).toBe('iostream')
    })

    it('lifts local include correctly', () => {
      const node = liftFirst('#include "myheader.h"')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_include_local')
      expect(node!.properties.header).toBe('myheader.h')
    })

    it('roundtrips system include', () => {
      const code = gen('#include <iostream>')
      expect(code).toContain('#include <iostream>')
    })

    it('roundtrips local include', () => {
      const code = gen('#include "myheader.h"')
      expect(code).toContain('#include "myheader.h"')
    })

    it('renders system include to correct block', () => {
      const state = blocks('#include <iostream>')
      const topBlocks = state.blocks?.blocks ?? []
      expect(topBlocks.length).toBeGreaterThan(0)
      const includeBlock = topBlocks[0]
      expect(includeBlock.type).toBe('c_include')
      expect(includeBlock.fields?.HEADER).toBe('iostream')
    })
  })

  describe('#define', () => {
    it('lifts #define correctly', () => {
      const node = liftFirst('#define MAX 100')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_define')
      expect(node!.properties.name).toBe('MAX')
      expect(node!.properties.value).toBe('100')
    })

    it('roundtrips #define', () => {
      const code = gen('#define MAX 100')
      expect(code).toContain('#define MAX 100')
    })
  })

  describe('using namespace', () => {
    it('lifts using namespace correctly', () => {
      const node = liftFirst('using namespace std;')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_using_namespace')
      expect(node!.properties.ns).toBe('std')
    })

    it('roundtrips using namespace', () => {
      const code = gen('using namespace std;')
      expect(code).toContain('using namespace std;')
    })
  })
})

// ════════════════════════════════════════════
// 2. DECLARATIONS
// ════════════════════════════════════════════

describe('Declarations', () => {
  describe('Single variable', () => {
    it('lifts int x; correctly', () => {
      const node = liftFirst('int x;')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('var_declare')
      expect(node!.properties.type).toBe('int')
      expect(node!.properties.name).toBe('x')
    })

    it('lifts int x = 5; correctly', () => {
      const node = liftFirst('int x = 5;')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('var_declare')
      expect(node!.properties.name).toBe('x')
      const inits = node!.children.initializer ?? []
      expect(inits.length).toBe(1)
      expect(inits[0].concept).toBe('number_literal')
      expect(inits[0].properties.value).toBe('5')
    })

    it('lifts string name = "hello"; correctly', () => {
      const node = liftFirst('string name = "hello";')
      expect(node).not.toBeNull()
      expect(node!.properties.type).toBe('string')
      const inits = node!.children.initializer ?? []
      expect(inits.length).toBe(1)
      expect(inits[0].concept).toBe('string_literal')
      expect(inits[0].properties.value).toBe('hello')
    })

    it('roundtrips int x = 5;', () => {
      const code = gen('int x = 5;')
      expect(code).toContain('int x = 5;')
    })

    it('roundtrips int y;', () => {
      const code = gen('int y;')
      expect(code).toContain('int y;')
    })
  })

  describe('Multi-variable declaration', () => {
    it('lifts int a, b = 5; correctly', () => {
      const node = liftFirst('int a, b = 5;')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('var_declare')
      expect(node!.properties.type).toBe('int')
      const decls = node!.children.declarators ?? []
      expect(decls.length).toBe(2)
      expect(decls[0].properties.name).toBe('a')
      expect(decls[1].properties.name).toBe('b')
      const bInits = decls[1].children.initializer ?? []
      expect(bInits.length).toBe(1)
    })

    it('roundtrips int a, b = 5;', () => {
      const code = gen('int a, b = 5;')
      expect(code).toContain('int a, b = 5;')
    })

    it('renders multi-var declare to block with extraState', () => {
      const state = blocks('int a, b = 5;')
      const topBlocks = state.blocks?.blocks ?? []
      const declBlock = topBlocks[0]
      expect(declBlock.type).toBe('u_var_declare')
      expect(declBlock.extraState).toBeDefined()
      expect(declBlock.extraState?.items).toContain('var')
      expect(declBlock.extraState?.items).toContain('var_init')
    })
  })

  describe('Variable assignment', () => {
    it('lifts x = 10; correctly', () => {
      const node = liftFirst('x = 10;')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('var_assign')
      expect(node!.properties.name).toBe('x')
    })

    it('roundtrips x = 10;', () => {
      const code = gen('x = 10;')
      expect(code).toContain('x = 10;')
    })
  })

  describe('Array declaration', () => {
    it('lifts int arr[10]; correctly', () => {
      const node = liftFirst('int arr[10];')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('array_declare')
    })

    it('roundtrips int arr[10];', () => {
      const code = gen('int arr[10];')
      expect(code).toContain('int arr[10];')
    })
  })
})

// ════════════════════════════════════════════
// 3. EXPRESSIONS
// ════════════════════════════════════════════

describe('Expressions', () => {
  // Helper: lift an expression from "int _t = EXPR;"
  function liftExpr(expr: string): SemanticNode | null {
    const node = liftFirst(`int _t = ${expr};`)
    if (!node) return null
    const inits = node.children.initializer ?? []
    return inits[0] ?? null
  }

  describe('Literals', () => {
    it('lifts number literal', () => {
      const n = liftExpr('42')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('number_literal')
      expect(n!.properties.value).toBe('42')
    })

    it('lifts string literal (strips quotes)', () => {
      const body = liftBody('string s = "hello world";')
      const node = body[0]
      const inits = node?.children.initializer ?? []
      expect(inits[0]?.concept).toBe('string_literal')
      expect(inits[0]?.properties.value).toBe('hello world')
    })

    it('lifts char literal (strips quotes)', () => {
      const body = liftBody("char c = 'A';")
      const node = body[0]
      const inits = node?.children.initializer ?? []
      expect(inits[0]?.concept).toBe('string_literal')
      expect(inits[0]?.properties.value).toBe('A')
    })
  })

  describe('Arithmetic', () => {
    it.each(['+', '-', '*', '/', '%'])('lifts binary %s', (op) => {
      const n = liftExpr(`a ${op} b`)
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('arithmetic')
      expect(n!.properties.operator).toBe(op)
      expect(n!.children.left?.[0]?.concept).toBe('var_ref')
      expect(n!.children.right?.[0]?.concept).toBe('var_ref')
    })

    it('roundtrips a + b', () => {
      const code = gen('int x = a + b;')
      expect(code).toContain('a + b')
    })

    it('roundtrips nested (a + b) * c', () => {
      const code = gen('int x = (a + b) * c;')
      expect(code).toContain('a + b')
      expect(code).toContain('* c')
    })
  })

  describe('Comparison', () => {
    it.each(['>', '<', '>=', '<=', '==', '!='])('lifts %s', (op) => {
      const n = liftExpr(`x ${op} y`)
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('compare')
      expect(n!.properties.operator).toBe(op)
    })
  })

  describe('Logical', () => {
    it.each(['&&', '||'])('lifts %s', (op) => {
      const n = liftExpr(`a ${op} b`)
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('logic')
      expect(n!.properties.operator).toBe(op)
    })

    it('lifts !x (logic_not)', () => {
      const n = liftExpr('!flag')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('logic_not')
    })

    it('roundtrips !flag', () => {
      const code = gen('bool r = !flag;')
      expect(code).toContain('!flag')
    })
  })

  describe('Unary negate', () => {
    it('lifts -x (negate)', () => {
      const n = liftExpr('-x')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('negate')
    })

    it('roundtrips -x', () => {
      const code = gen('int y = -x;')
      expect(code).toContain('-x')
    })
  })

  describe('Array access', () => {
    it('lifts arr[i]', () => {
      const n = liftExpr('arr[i]')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('array_access')
      expect(n!.properties.name).toBe('arr')
    })

    it('roundtrips arr[i] in expression', () => {
      const code = gen('int x = arr[i];')
      expect(code).toContain('arr[i]')
    })

    it('renders array_access block correctly', () => {
      const state = blocks('int x = arr[0];')
      const topBlocks = state.blocks?.blocks ?? []
      const declBlock = topBlocks[0]
      // Find the array access block in the input tree
      const initInput = declBlock?.inputs?.INIT_0?.block
      expect(initInput).toBeDefined()
      expect(initInput?.type).toBe('u_array_access')
      expect(initInput?.fields?.NAME).toBe('arr')
    })
  })

  describe('Function call expression', () => {
    it('lifts strlen(s) as func_call_expr', () => {
      const n = liftExpr('strlen(s)')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('func_call_expr')
      expect(n!.properties.name).toBe('strlen')
      const args = n!.children.args ?? []
      expect(args.length).toBe(1)
    })

    it('roundtrips strlen(s)', () => {
      const code = gen('int x = strlen(s);')
      expect(code).toContain('strlen(s)')
    })
  })

  describe('Variable reference', () => {
    it('lifts identifier as var_ref', () => {
      const n = liftExpr('myVar')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('var_ref')
      expect(n!.properties.name).toBe('myVar')
    })

    it('lifts true as builtin_constant', () => {
      const n = liftExpr('true')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('builtin_constant')
      expect(n!.properties.value).toBe('true')
    })

    it('lifts false as builtin_constant', () => {
      const n = liftExpr('false')
      expect(n).not.toBeNull()
      expect(n!.concept).toBe('builtin_constant')
      expect(n!.properties.value).toBe('false')
    })
  })
})

// ════════════════════════════════════════════
// 4. I/O (cout, cin, endl)
// ════════════════════════════════════════════

describe('I/O', () => {
  describe('cout (print)', () => {
    it('lifts cout << "hello"; as print with string value', () => {
      const body = liftBody('int main() { cout << "hello"; }')
      const mainNode = body[0]
      const mainBody = mainNode?.children.body ?? []
      const printNode = mainBody[0]
      expect(printNode).not.toBeNull()
      expect(printNode!.concept).toBe('print')
      const values = printNode!.children.values ?? []
      expect(values.length).toBe(1)
      expect(values[0].concept).toBe('string_literal')
      expect(values[0].properties.value).toBe('hello')
    })

    it('lifts cout << x << y; as print with two values', () => {
      const body = liftBody('int main() { cout << x << y; }')
      const mainBody = body[0]?.children.body ?? []
      const printNode = mainBody[0]
      expect(printNode!.concept).toBe('print')
      const values = printNode!.children.values ?? []
      expect(values.length).toBe(2)
      expect(values[0].concept).toBe('var_ref')
      expect(values[1].concept).toBe('var_ref')
    })

    it('lifts cout << "hi" << endl; with endl concept', () => {
      const body = liftBody('int main() { cout << "hi" << endl; }')
      const mainBody = body[0]?.children.body ?? []
      const printNode = mainBody[0]
      expect(printNode!.concept).toBe('print')
      const values = printNode!.children.values ?? []
      expect(values.length).toBe(2)
      expect(values[0].concept).toBe('string_literal')
      expect(values[1].concept).toBe('endl')
    })

    it('roundtrips cout << "big" << endl;', () => {
      const code = gen('int main() { cout << "big" << endl; }')
      expect(code).toContain('cout << "big" << endl;')
    })

    it('roundtrips cout << x << " " << y << endl;', () => {
      const code = gen('int main() { cout << x << " " << y << endl; }')
      expect(code).toContain('cout')
      expect(code).toContain('endl')
    })

    it('renders print block with endl', () => {
      const state = blocks('int main() { cout << "hi" << endl; }')
      const topBlocks = state.blocks?.blocks ?? []
      const mainBlock = topBlocks[0]
      const bodyChain = mainBlock?.inputs?.BODY?.block
      expect(bodyChain).toBeDefined()
      expect(bodyChain!.type).toBe('u_print')
      // Should have at least 2 expression inputs (string + endl)
      expect(bodyChain!.extraState?.itemCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('cin (input)', () => {
    it('lifts cin >> x; as input with one variable', () => {
      const body = liftBody('int main() { cin >> x; }')
      const mainBody = body[0]?.children.body ?? []
      const inputNode = mainBody[0]
      expect(inputNode).not.toBeNull()
      expect(inputNode!.concept).toBe('input')
      const values = inputNode!.children.values ?? []
      expect(values.length).toBe(1)
      expect(values[0].concept).toBe('var_ref')
      expect(values[0].properties.name).toBe('x')
    })

    it('lifts cin >> x >> y; as input with two variables', () => {
      const body = liftBody('int main() { cin >> x >> y; }')
      const mainBody = body[0]?.children.body ?? []
      const inputNode = mainBody[0]
      expect(inputNode!.concept).toBe('input')
      const values = inputNode!.children.values ?? []
      expect(values.length).toBe(2)
    })

    it('roundtrips cin >> name;', () => {
      const code = gen('int main() { cin >> name; }')
      expect(code).toContain('cin >> name;')
    })

    it('roundtrips cin >> x >> y;', () => {
      const code = gen('int main() { cin >> x >> y; }')
      expect(code).toContain('cin >> x >> y;')
    })

    it('lifts if (cin >> a >> n >> m) as if with input condition', () => {
      const body = liftBody('int main() { if (cin >> a >> n >> m) {} }')
      const mainBody = body[0]?.children.body ?? []
      const ifNode = mainBody[0]
      expect(ifNode).toBeDefined()
      expect(ifNode!.concept).toBe('if')
      const cond = (ifNode!.children.condition ?? [])[0]
      expect(cond).toBeDefined()
      expect(cond!.concept).toBe('input')
      const values = cond!.children.values ?? []
      expect(values.length).toBe(3)
      expect(values[0].properties.name).toBe('a')
      expect(values[1].properties.name).toBe('n')
      expect(values[2].properties.name).toBe('m')
    })

    it('renders input block with args extraState for multiple vars', () => {
      const state = blocks('int main() { cin >> a >> b; }')
      const topBlocks = state.blocks?.blocks ?? []
      const mainBlock = topBlocks[0]
      const bodyChain = mainBlock?.inputs?.BODY?.block
      expect(bodyChain).toBeDefined()
      expect(bodyChain!.type).toBe('u_input')
      // extraState.args matches u_input's loadExtraState format
      const args = bodyChain!.extraState?.args as Array<{ mode: string; text: string }>
      expect(args).toBeDefined()
      expect(args.length).toBe(2)
      expect(args[0]).toEqual({ mode: 'select', text: 'a' })
      expect(args[1]).toEqual({ mode: 'select', text: 'b' })
    })
  })

  describe('endl', () => {
    it('lifts endl identifier as endl concept (not var_ref)', () => {
      const body = liftBody('int main() { cout << endl; }')
      const mainBody = body[0]?.children.body ?? []
      const printNode = mainBody[0]
      const values = printNode?.children.values ?? []
      expect(values.length).toBeGreaterThan(0)
      const endlNode = values[values.length - 1]
      expect(endlNode.concept).toBe('endl')
    })

    it('generates endl token in cout context', () => {
      const code = gen('int main() { cout << endl; }')
      expect(code).toContain('cout << endl;')
    })

    it('renders endl block (u_endl)', () => {
      const state = blocks('int main() { cout << endl; }')
      const topBlocks = state.blocks?.blocks ?? []
      const mainBlock = topBlocks[0]
      const printBlock = mainBlock?.inputs?.BODY?.block
      expect(printBlock?.type).toBe('u_print')
      // Check that one of the expression inputs is u_endl
      const inputs = printBlock?.inputs ?? {}
      const endlInput = Object.values(inputs).find(
        (inp: any) => inp.block?.type === 'u_endl'
      )
      expect(endlInput).toBeDefined()
    })
  })
})

// ════════════════════════════════════════════
// 5. CONTROL FLOW
// ════════════════════════════════════════════

describe('Control Flow', () => {
  describe('if / if-else', () => {
    it('lifts if without else', () => {
      const body = liftBody('int main() { if (x > 0) { y = 1; } }')
      const mainBody = body[0]?.children.body ?? []
      const ifNode = mainBody[0]
      expect(ifNode!.concept).toBe('if')
      expect(ifNode!.children.condition?.length).toBe(1)
      expect(ifNode!.children.then_body?.length).toBeGreaterThan(0)
      expect(ifNode!.children.else_body?.length ?? 0).toBe(0)
    })

    it('lifts if-else', () => {
      const body = liftBody('int main() { if (x > 0) { y = 1; } else { y = 2; } }')
      const mainBody = body[0]?.children.body ?? []
      const ifNode = mainBody[0]
      expect(ifNode!.concept).toBe('if')
      expect(ifNode!.children.else_body?.length).toBeGreaterThan(0)
    })

    it('renders if-else block with hasElse extraState', () => {
      const state = blocks('int main() { if (x > 0) { y = 1; } else { y = 2; } }')
      const mainBlock = state.blocks?.blocks?.[0]
      const ifBlock = mainBlock?.inputs?.BODY?.block
      expect(ifBlock?.type).toBe('u_if')
      expect(ifBlock?.extraState?.hasElse).toBe(true)
    })

    it('roundtrips if-else', () => {
      const code = gen('int main() { if (x > 0) { y = 1; } else { y = 2; } }')
      expect(code).toContain('if (x > 0)')
      expect(code).toContain('else')
    })
  })

  describe('while loop', () => {
    it('lifts while loop', () => {
      const body = liftBody('int main() { while (x > 0) { x = x - 1; } }')
      const mainBody = body[0]?.children.body ?? []
      const whileNode = mainBody[0]
      expect(whileNode!.concept).toBe('while_loop')
    })

    it('roundtrips while loop', () => {
      const code = gen('int main() { while (x > 0) { x = x - 1; } }')
      expect(code).toContain('while (x > 0)')
    })
  })

  describe('for loop (counting)', () => {
    it('lifts counting for as count_loop', () => {
      const body = liftBody('int main() { for (int i = 0; i < 10; i++) { x = i; } }')
      const mainBody = body[0]?.children.body ?? []
      const forNode = mainBody[0]
      expect(forNode!.concept).toBe('count_loop')
      expect(forNode!.properties.var_name).toBe('i')
    })

    it('roundtrips counting for loop', () => {
      const code = gen('int main() { for (int i = 0; i < 10; i++) { x = i; } }')
      expect(code).toContain('for (int i = 0; i < 10; i++)')
    })
  })

  describe('break / continue', () => {
    it('lifts break', () => {
      const body = liftBody('int main() { while(1) { break; } }')
      const whileBody = body[0]?.children.body?.[0]?.children.body ?? []
      const breakNode = whileBody[0]
      expect(breakNode!.concept).toBe('break')
    })

    it('lifts continue', () => {
      const body = liftBody('int main() { while(1) { continue; } }')
      const whileBody = body[0]?.children.body?.[0]?.children.body ?? []
      const contNode = whileBody[0]
      expect(contNode!.concept).toBe('continue')
    })

    it('roundtrips break', () => {
      const code = gen('int main() { while(1) { break; } }')
      expect(code).toContain('break;')
    })

    it('roundtrips continue', () => {
      const code = gen('int main() { while(1) { continue; } }')
      expect(code).toContain('continue;')
    })
  })
})

// ════════════════════════════════════════════
// 6. FUNCTIONS
// ════════════════════════════════════════════

describe('Functions', () => {
  describe('Function definition', () => {
    it('lifts int main() {}', () => {
      const node = liftFirst('int main() {}')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('func_def')
      expect(node!.properties.name).toBe('main')
      expect(node!.properties.return_type).toBe('int')
    })

    it('lifts function with params', () => {
      const node = liftFirst('int add(int a, int b) { return a + b; }')
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('func_def')
      expect(node!.properties.name).toBe('add')
      const params = node!.properties.params as string[]
      expect(params).toContain('int a')
      expect(params).toContain('int b')
    })

    it('lifts void function', () => {
      const node = liftFirst('void greet() { cout << "hi"; }')
      expect(node).not.toBeNull()
      expect(node!.properties.return_type).toBe('void')
    })

    it('roundtrips int main with body', () => {
      const code = gen('int main() { return 0; }')
      expect(code).toContain('int main()')
      expect(code).toContain('return 0;')
    })

    it('roundtrips function with params', () => {
      const code = gen('int add(int a, int b) { return a + b; }')
      expect(code).toContain('int add(int a, int b)')
    })

    it('renders func_def block with params', () => {
      const state = blocks('int add(int a, int b) { return a + b; }')
      const topBlocks = state.blocks?.blocks ?? []
      const funcBlock = topBlocks[0]
      expect(funcBlock.type).toBe('u_func_def')
      expect(funcBlock.fields?.NAME).toBe('add')
      expect(funcBlock.fields?.RETURN_TYPE).toBe('int')
      expect(funcBlock.extraState?.paramCount).toBe(2)
    })
  })

  describe('Function call (statement)', () => {
    it('lifts func(); as func_call', () => {
      const body = liftBody('int main() { greet(); }')
      const mainBody = body[0]?.children.body ?? []
      const callNode = mainBody[0]
      expect(callNode).not.toBeNull()
      expect(callNode!.concept).toBe('func_call')
      expect(callNode!.properties.name).toBe('greet')
    })

    it('lifts func(a, b); with args', () => {
      const body = liftBody('int main() { add(1, 2); }')
      const mainBody = body[0]?.children.body ?? []
      const callNode = mainBody[0]
      expect(callNode!.concept).toBe('func_call')
      const args = callNode!.children.args ?? []
      expect(args.length).toBe(2)
    })

    it('roundtrips greet();', () => {
      const code = gen('int main() { greet(); }')
      expect(code).toContain('greet();')
    })

    it('roundtrips add(1, 2);', () => {
      const code = gen('int main() { add(1, 2); }')
      expect(code).toContain('add(1, 2);')
    })

    it('renders func_call block with args', () => {
      const state = blocks('int main() { add(1, 2); }')
      const mainBlock = state.blocks?.blocks?.[0]
      const callBlock = mainBlock?.inputs?.BODY?.block
      expect(callBlock?.type).toBe('u_func_call')
      expect(callBlock?.fields?.NAME).toBe('add')
      expect(callBlock?.extraState?.argCount).toBe(2)
    })
  })

  describe('Return', () => {
    it('lifts return 0;', () => {
      const body = liftBody('int main() { return 0; }')
      const mainBody = body[0]?.children.body ?? []
      const retNode = mainBody[0]
      expect(retNode!.concept).toBe('return')
      const vals = retNode!.children.value ?? []
      expect(vals.length).toBe(1)
      expect(vals[0].concept).toBe('number_literal')
    })

    it('lifts return; (no value)', () => {
      const body = liftBody('void f() { return; }')
      const fBody = body[0]?.children.body ?? []
      const retNode = fBody[0]
      expect(retNode!.concept).toBe('return')
      const vals = retNode!.children.value ?? []
      expect(vals.length).toBe(0)
    })

    it('roundtrips return 0;', () => {
      const code = gen('int main() { return 0; }')
      expect(code).toContain('return 0;')
    })

    it('roundtrips return;', () => {
      const code = gen('void f() { return; }')
      expect(code).toContain('return;')
    })
  })
})

// ════════════════════════════════════════════
// 7. COMMENTS
// ════════════════════════════════════════════

describe('Comments', () => {
  it('lifts // line comment (strips prefix)', () => {
    const node = liftFirst('// this is a comment')
    expect(node).not.toBeNull()
    expect(node!.concept).toBe('comment')
    expect(node!.properties.text).toBe('this is a comment')
  })

  it('lifts /* block comment */ (strips delimiters)', () => {
    const node = liftFirst('/* block comment */')
    expect(node).not.toBeNull()
    expect(node!.concept).toBe('block_comment')
    expect(node!.properties.text).toBe('block comment')
  })
})

// ════════════════════════════════════════════
// 8. COMPOUND ASSIGNMENT & INCREMENT
// ════════════════════════════════════════════

describe('Compound Assignment & Increment', () => {
  describe('Compound assignment (+=, -=, etc.)', () => {
    it('lifts x += 5; as cpp_compound_assign', () => {
      const body = liftBody('int main() { x += 5; }')
      const mainBody = body[0]?.children.body ?? []
      const node = mainBody[0]
      expect(node).not.toBeNull()
      // Should be cpp_compound_assign, NOT var_assign
      expect(node!.concept).toBe('cpp_compound_assign')
      expect(node!.properties.name).toBe('x')
      expect(node!.properties.operator).toBe('+=')
    })

    it('lifts x -= 3; correctly', () => {
      const body = liftBody('int main() { x -= 3; }')
      const mainBody = body[0]?.children.body ?? []
      const node = mainBody[0]
      expect(node!.concept).toBe('cpp_compound_assign')
      expect(node!.properties.operator).toBe('-=')
    })

    it('roundtrips x += 5;', () => {
      const code = gen('int main() { x += 5; }')
      expect(code).toContain('x += 5;')
    })

    it('renders compound assign block', () => {
      const state = blocks('int main() { x += 5; }')
      const mainBlock = state.blocks?.blocks?.[0]
      const compBlock = mainBlock?.inputs?.BODY?.block
      expect(compBlock?.type).toBe('c_compound_assign')
      expect(compBlock?.fields?.NAME).toBe('x')
      expect(compBlock?.fields?.OP).toBe('+=')
    })
  })

  describe('Increment / Decrement (i++, i--)', () => {
    it('lifts i++ as cpp_increment', () => {
      const body = liftBody('int main() { i++; }')
      const mainBody = body[0]?.children.body ?? []
      const node = mainBody[0]
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_increment')
      expect(node!.properties.name).toBe('i')
      expect(node!.properties.operator).toBe('++')
    })

    it('lifts i-- as cpp_increment with -- operator', () => {
      const body = liftBody('int main() { i--; }')
      const mainBody = body[0]?.children.body ?? []
      const node = mainBody[0]
      expect(node!.concept).toBe('cpp_increment')
      expect(node!.properties.operator).toBe('--')
    })

    it('roundtrips i++;', () => {
      const code = gen('int main() { i++; }')
      expect(code).toContain('i++')
    })

    it('renders increment block', () => {
      const state = blocks('int main() { i++; }')
      const mainBlock = state.blocks?.blocks?.[0]
      const incBlock = mainBlock?.inputs?.BODY?.block
      expect(incBlock?.type).toBe('c_increment')
      expect(incBlock?.fields?.NAME).toBe('i')
    })
  })
})

// ════════════════════════════════════════════
// 9. FULL PROGRAM ROUNDTRIP
// ════════════════════════════════════════════

describe('Full Program Roundtrip', () => {
  it('roundtrips a complete APCS-style program', () => {
    const input = `#include <iostream>
using namespace std;

int main() {
    int x = 5;
    string name = "hello";
    int sum = x + 10;
    if (x > 3) {
        cout << "big" << endl;
    } else {
        cout << "small" << endl;
    }
    cin >> name;
    cout << sum << endl;
    return 0;
}`
    const code = gen(input)
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main()')
    expect(code).toContain('int x = 5;')
    expect(code).toContain('string name = "hello";')
    expect(code).toContain('x + 10')
    expect(code).toContain('if (x > 3)')
    expect(code).toContain('"big"')
    expect(code).toContain('endl')
    expect(code).toContain('else')
    expect(code).toContain('"small"')
    expect(code).toContain('cin >> name;')
    expect(code).toContain('cout << sum << endl;')
    expect(code).toContain('return 0;')
  })

  it('roundtrips a function-heavy program', () => {
    const input = `#include <iostream>
using namespace std;

int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(3, 4);
    cout << result << endl;
    return 0;
}`
    const code = gen(input)
    expect(code).toContain('int add(int a, int b)')
    expect(code).toContain('return a + b;')
    expect(code).toContain('add(3, 4)')
    expect(code).toContain('cout << result << endl;')
  })

  it('renders a complete program to valid block state', () => {
    const input = `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    cout << x << endl;
    return 0;
}`
    const state = blocks(input)
    const topBlocks = state.blocks?.blocks ?? []
    // Blocks are chained via next — first block in array, rest linked
    expect(topBlocks.length).toBeGreaterThanOrEqual(1)
    // Walk the chain to collect all block types
    const types: string[] = []
    let current: any = topBlocks[0]
    while (current) {
      types.push(current.type)
      current = current.next?.block
    }
    expect(types).toContain('c_include')
    expect(types).toContain('c_using_namespace')
    expect(types).toContain('u_func_def')
  })
})
