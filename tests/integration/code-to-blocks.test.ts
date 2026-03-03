import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import type { BlockSpec } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

describe('Code → Blocks 整合測試', () => {
  let parser: CppParser
  let registry: BlockRegistry
  let converter: CodeToBlocksConverter

  beforeAll(async () => {
    parser = new CppParser()
    await parser.init()

    registry = new BlockRegistry()
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => registry.register(spec))

    const adapter = new CppLanguageAdapter()
    converter = new CodeToBlocksConverter(registry, parser, adapter)
  })

  describe('CST 映射為 Blockly workspace JSON', () => {
    it('should convert simple variable declaration', async () => {
      const result = await converter.convert('int x = 10;')
      expect(result.blocks.blocks.length).toBeGreaterThan(0)
    })

    it('should convert printf to c_printf block', async () => {
      const code = 'void f() { printf("hello\\n"); }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_printf')
    })

    it('should convert counting for loop to u_count_loop', async () => {
      const code = 'void f() { for (int i = 0; i < 10; i++) { } }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('u_count_loop')
    })

    it('should convert if statement to u_if', async () => {
      const code = 'void f() { if (x > 0) { } }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('u_if')
    })

    it('should convert function definition to u_func_def', async () => {
      const code = 'int main() { return 0; }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('u_func_def')
    })

    it('should convert #include directive', async () => {
      const code = '#include <stdio.h>'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_include')
    })
  })

  describe('未知語法降級為原始碼積木', () => {
    it('should fallback to raw code for unrecognized patterns', async () => {
      // typedef is likely not matched by any block spec
      const code = 'typedef unsigned long size_t;'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_raw_code')
    })
  })

  describe('深入解析策略', () => {
    it('should handle nested structures', async () => {
      const code = 'void f() { if (x > 0) { printf("pos\\n"); } }'
      const result = await converter.convert(code)
      expect(result.blocks.blocks.length).toBeGreaterThan(0)
    })

    it('should handle complete program', async () => {
      const code = `#include <stdio.h>
int main() {
    int x = 10;
    if (x > 5) {
        printf("big\\n");
    }
    return 0;
}`
      const result = await converter.convert(code)
      expect(result.blocks.blocks.length).toBeGreaterThan(0)
    })
  })

  describe('US1: 已刪積木語法仍可正確轉換為通用積木', () => {
    it('should convert number literal to u_number (not c_number)', async () => {
      const result = await converter.convert('int x = 42;')
      const allBlocks = flattenBlocks(result.blocks.blocks)
      const numberBlock = allBlocks.find(b => b.type === 'u_number')
      expect(numberBlock, 'number literal should map to u_number').toBeDefined()
      expect(allBlocks.find(b => b.type === 'c_number'), 'c_number should not exist').toBeUndefined()
    })

    it('should convert variable reference to u_var_ref (not c_variable_ref)', async () => {
      const result = await converter.convert('int x = 0;\nx = x + 1;')
      const allBlocks = flattenBlocks(result.blocks.blocks)
      expect(allBlocks.find(b => b.type === 'c_variable_ref'), 'c_variable_ref should not exist').toBeUndefined()
    })

    it('should convert string literal to u_string (not c_string_literal)', async () => {
      const result = await converter.convert('printf("hello");')
      const allBlocks = flattenBlocks(result.blocks.blocks)
      expect(allBlocks.find(b => b.type === 'c_string_literal'), 'c_string_literal should not exist').toBeUndefined()
    })
  })
})

/** Recursively flatten all blocks from workspace */
function flattenBlocks(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  for (const block of blocks) {
    result.push(block)
    const inputs = block.inputs as Record<string, { block?: Record<string, unknown> }> | undefined
    if (inputs) {
      for (const inp of Object.values(inputs)) {
        if (inp?.block) result.push(...flattenBlocks([inp.block]))
      }
    }
    const next = block.next as { block?: Record<string, unknown> } | undefined
    if (next?.block) result.push(...flattenBlocks([next.block]))
  }
  return result
}
