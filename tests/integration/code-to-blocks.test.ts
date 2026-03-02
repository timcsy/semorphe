import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { BlockSpec } from '../../src/core/types'
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
    const allBlocks = [...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => registry.register(spec))

    converter = new CodeToBlocksConverter(registry, parser)
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

    it('should convert for loop', async () => {
      const code = 'void f() { for (int i = 0; i < 10; i++) { } }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_for_loop')
    })

    it('should convert if statement', async () => {
      const code = 'void f() { if (x > 0) { } }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_if')
    })

    it('should convert function definition', async () => {
      const code = 'int main() { return 0; }'
      const result = await converter.convert(code)
      const blocks = JSON.stringify(result)
      expect(blocks).toContain('c_function_def')
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
      // Should have function_def containing if containing printf
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
})
