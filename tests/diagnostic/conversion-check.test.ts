/**
 * 系統性轉換診斷測試
 * 測試各種 C 程式碼樣本的 code→blocks→code roundtrip
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { BlockSpec } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

let registry: BlockRegistry
let generator: CppGenerator
let parser: CppParser
let adapter: CppLanguageAdapter
let converter: CodeToBlocksConverter

beforeAll(async () => {
  registry = new BlockRegistry()
  const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
  allBlocks.forEach(spec => registry.register(spec))

  adapter = new CppLanguageAdapter()
  generator = new CppGenerator(registry, adapter)
  parser = new CppParser()
  await parser.init()
  converter = new CodeToBlocksConverter(registry, parser, adapter)
})

async function dumpAST(code: string): Promise<string> {
  const tree = await parser.parse(code)
  const lines: string[] = []
  function walk(node: any, depth: number) {
    const indent = '  '.repeat(depth)
    const fieldName = node.parent
      ? (() => {
          for (const child of node.parent.children) {
            if (child.id === node.id) return ''
          }
          return ''
        })()
      : ''
    lines.push(`${indent}${node.type}${node.isNamed ? '' : ' [unnamed]'} "${node.text.substring(0, 60).replace(/\n/g, '\\n')}"`)
    for (const child of node.children) {
      walk(child, depth + 1)
    }
  }
  walk(tree.rootNode, 0)
  return lines.join('\n')
}

async function roundtrip(code: string): Promise<{ blocks: unknown; generated: string; ast: string }> {
  const ast = await dumpAST(code)
  const blocks = await converter.convert(code)
  const generated = generator.generate(blocks as any)
  return { blocks, generated, ast }
}

describe('系統性轉換診斷', () => {
  describe('1. 基本 Hello World', () => {
    it('hello world 完整程式', async () => {
      const code = `#include <stdio.h>

int main() {
    printf("Hello, World!");
    return 0;
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('#include <stdio.h>')
      expect(generated).toContain('printf')
      expect(generated).toContain('return 0')
    })
  })

  describe('2. 變數宣告', () => {
    it('int 宣告 + 初始化', async () => {
      const code = `int x = 10;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('int')
      expect(generated).toContain('x')
      expect(generated).toContain('10')
    })

    it('多變數宣告', async () => {
      const code = `int a = 1;
float b = 2.5;
char c = 'A';`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('int')
      expect(generated).toContain('float')
      expect(generated).toContain('char')
    })

    it('無初始化的宣告', async () => {
      const code = `int x;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('int')
      expect(generated).toContain('x')
    })
  })

  describe('3. 陣列', () => {
    it('陣列宣告', async () => {
      const code = `int arr[10];`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('arr')
    })
  })

  describe('4. 條件', () => {
    it('if-else', async () => {
      const code = `if (x > 0) {
    printf("positive");
} else {
    printf("non-positive");
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('if')
      expect(generated).toContain('else')
    })

    it('單純 if', async () => {
      const code = `if (a == 1) {
    x = 10;
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('if')
    })
  })

  describe('5. 迴圈', () => {
    it('for 迴圈', async () => {
      const code = `for (int i = 0; i < 10; i++) {
    printf("%d", i);
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('for')
    })

    it('while 迴圈', async () => {
      const code = `while (x > 0) {
    x--;
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('while')
    })
  })

  describe('6. 函式', () => {
    it('void 函式', async () => {
      const code = `void hello() {
    printf("hi");
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('void')
      expect(generated).toContain('hello')
    })

    it('帶參數的函式', async () => {
      const code = `int add(int a, int b) {
    return a + b;
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('int')
      expect(generated).toContain('add')
      expect(generated).toContain('return')
    })
  })

  describe('7. 運算式', () => {
    it('算術運算', async () => {
      const code = `int x = a + b * c;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('+')
      expect(generated).toContain('*')
    })

    it('賦值運算', async () => {
      const code = `x = x + 1;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
    })
  })

  describe('8. I/O', () => {
    it('printf 帶格式字串', async () => {
      const code = `printf("%d %d\\n", a, b);`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('printf')
    })

    it('scanf', async () => {
      const code = `scanf("%d", &x);`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('scanf')
    })
  })

  describe('9. 前處理', () => {
    it('#include', async () => {
      const code = `#include <stdio.h>`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('#include <stdio.h>')
    })

    it('#define', async () => {
      const code = `#define MAX 100`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('#define')
      expect(generated).toContain('MAX')
    })
  })

  describe('10. 完整 APCS 範例程式', () => {
    it('APCS 典型程式', async () => {
      const code = `#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int sum = 0;
    for (int i = 1; i <= n; i++) {
        sum = sum + i;
    }
    printf("Sum = %d\\n", sum);
    return 0;
}`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('#include <stdio.h>')
      expect(generated).toContain('main')
      expect(generated).toContain('scanf')
      expect(generated).toContain('for')
      expect(generated).toContain('printf')
      expect(generated).toContain('return')
    })
  })

  describe('11. expression_statement 處理', () => {
    it('函式呼叫作為 statement', async () => {
      const code = `printf("hello");`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('printf')
    })

    it('i++ 作為 statement', async () => {
      const code = `i++;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('i')
      expect(generated).toContain('++')
    })

    it('assignment 作為 statement', async () => {
      const code = `x = 5;`
      const { blocks, generated, ast } = await roundtrip(code)
      console.log('=== AST ===\n', ast)
      console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
      console.log('=== Generated ===\n', generated)
      expect(generated).toContain('x')
      expect(generated).toContain('5')
    })
  })
})

describe('T036: Performance verification', () => {
  it('blocks→code sync should complete in < 1s', () => {
    const workspace = {
      blocks: { languageVersion: 0, blocks: [{
        type: 'u_func_def', id: 'b1',
        fields: { NAME: 'main', RETURN_TYPE: 'int', PARAMS: '' },
        inputs: {
          BODY: { block: {
            type: 'u_count_loop', id: 'b2',
            fields: { VAR: 'i' },
            inputs: {
              FROM: { block: { type: 'u_number', id: 'b3', fields: { NUM: 0 } } },
              TO: { block: { type: 'u_number', id: 'b4', fields: { NUM: 100 } } },
              BODY: { block: {
                type: 'u_print', id: 'b5',
                inputs: {
                  EXPR0: { block: { type: 'u_var_ref', id: 'vi', fields: { NAME: 'i' } } },
                  EXPR1: { block: { type: 'u_endl', id: 'endl1' } },
                },
              }},
            },
            next: { block: { type: 'u_return', id: 'b6', inputs: { VALUE: { block: { type: 'u_number', id: 'b7', fields: { NUM: 0 } } } } } },
          }},
        },
      }] },
    }
    const start = performance.now()
    const code = generator.generate(workspace as any)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000)
    expect(code).toContain('int main()')
    expect(code).toContain('for (int i = 0;')
  })

  it('code→blocks sync should complete in < 2s', async () => {
    const code = `
#include <iostream>
using namespace std;
int main() {
    for (int i = 0; i < 10; i++) {
        if (i > 5) {
            cout << i << endl;
        }
    }
    return 0;
}
`
    const start = performance.now()
    const result = await converter.convert(code)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(2000)
    expect(result.blocks.blocks.length).toBeGreaterThan(0)
  })
})

describe('T037: Edge cases', () => {
  it('unrecognized syntax → raw code block', async () => {
    const code = `asm("nop");`
    const result = await converter.convert(code)
    const blocks = result.blocks.blocks
    expect(blocks.length).toBeGreaterThan(0)
    // Should produce a raw code block for unknown syntax
    const allBlocks = flattenBlocks(blocks)
    const hasRaw = allBlocks.some((b: any) => b.type === 'c_raw_code' || b.type === 'c_raw_expression')
    expect(hasRaw).toBe(true)
  })

  it('counting for-loop should use u_count_loop', async () => {
    const code = `void f() { for (int i = 0; i < 10; i++) { break; } }`
    const result = await converter.convert(code)
    const allBlocks = flattenBlocks(result.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'u_count_loop')).toBe(true)
  })

  it('non-counting for-loop should use c_for_loop', async () => {
    const code = `void f() { for (;;) { break; } }`
    const result = await converter.convert(code)
    const allBlocks = flattenBlocks(result.blocks.blocks)
    expect(allBlocks.some((b: any) => b.type === 'c_for_loop')).toBe(true)
  })

  it('mixed universal + special blocks in one program', async () => {
    const code = `
#include <stdio.h>
int main() {
    int x = 10;
    if (x > 5) {
        printf("big\\n");
    }
    return 0;
}
`
    const result = await converter.convert(code)
    const allBlocks = flattenBlocks(result.blocks.blocks)
    const types = allBlocks.map((b: any) => b.type)

    // Should have both universal and language-specific blocks
    expect(types).toContain('u_func_def')      // universal
    expect(types).toContain('u_var_declare')    // universal
    expect(types).toContain('u_if')             // universal
    expect(types).toContain('c_printf')         // language-specific
    expect(types).toContain('c_include')        // language-specific
    expect(types).toContain('u_return')         // universal
  })
})

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
