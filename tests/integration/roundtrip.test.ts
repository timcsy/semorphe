import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { BlockSpec } from '../../src/core/types'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

describe('Roundtrip 測試 (Code → Block → Code)', () => {
  let parser: CppParser
  let registry: BlockRegistry
  let codeToBlocks: CodeToBlocksConverter
  let generator: CppGenerator

  beforeAll(async () => {
    parser = new CppParser()
    await parser.init()

    registry = new BlockRegistry()
    const allBlocks = [...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => registry.register(spec))

    codeToBlocks = new CodeToBlocksConverter(registry, parser)
    generator = new CppGenerator(registry)
  })

  describe('語意等價性驗證', () => {
    it('should roundtrip simple printf', async () => {
      const original = 'printf("hello\\n");'
      const wrappedCode = `void f() { ${original} }`
      const blocks = await codeToBlocks.convert(wrappedCode)
      const generated = generator.generate(blocks)

      // The generated code should contain the essential printf
      expect(generated).toContain('printf')
      expect(generated).toContain('hello')
    })

    it('should roundtrip variable declaration', async () => {
      const code = 'int x = 10;'
      const blocks = await codeToBlocks.convert(code)
      const generated = generator.generate(blocks)

      expect(generated).toContain('int')
      expect(generated).toContain('x')
      expect(generated).toContain('10')
    })

    it('should roundtrip for loop structure', async () => {
      const code = 'void f() { for (int i = 0; i < 10; i++) { printf("%d\\n", i); } }'
      const blocks = await codeToBlocks.convert(code)
      const generated = generator.generate(blocks)

      expect(generated).toContain('for')
      expect(generated).toContain('printf')
    })

    it('should roundtrip if-else structure', async () => {
      const code = 'void f() { if (x > 0) { printf("pos\\n"); } else { printf("neg\\n"); } }'
      const blocks = await codeToBlocks.convert(code)
      const generated = generator.generate(blocks)

      expect(generated).toContain('if')
      expect(generated).toContain('else')
    })

    it('should roundtrip #include directive', async () => {
      const code = '#include <stdio.h>'
      const blocks = await codeToBlocks.convert(code)
      const generated = generator.generate(blocks)

      expect(generated).toContain('#include')
      expect(generated).toContain('stdio.h')
    })
  })
})
