/**
 * C++ 專用轉換測試
 * 測試 C++ 特有語法的 code->blocks->code roundtrip
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { CppParser } from '../../src/languages/cpp/parser'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { BlockSpec } from '../../src/core/types'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

let registry: BlockRegistry
let generator: CppGenerator
let parser: CppParser
let converter: CodeToBlocksConverter

beforeAll(async () => {
  registry = new BlockRegistry()
  const allBlocks = [...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
  allBlocks.forEach(spec => registry.register(spec))

  generator = new CppGenerator(registry)
  parser = new CppParser()
  await parser.init()
  converter = new CodeToBlocksConverter(registry, parser)
})

async function roundtrip(code: string): Promise<{ blocks: unknown; generated: string }> {
  const blocks = await converter.convert(code)
  const generated = generator.generate(blocks as any)
  return { blocks, generated }
}

describe('C++ 專用轉換測試', () => {
  it('using namespace std', async () => {
    const code = 'using namespace std;'
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('using namespace std')
  })

  it('cout << x << endl', async () => {
    const code = 'cout << i << endl;'
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('cout')
    expect(generated).toContain('endl')
  })

  it('cout << 單一值', async () => {
    const code = 'cout << x;'
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('cout << x')
  })

  it('cin >> x', async () => {
    const code = 'cin >> x;'
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('cin >> x')
  })

  it('cin >> 多變數', async () => {
    const code = 'cin >> a >> b;'
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('cin')
    expect(generated).toContain('a')
    expect(generated).toContain('b')
  })

  it('完整 C++ iostream 程式', async () => {
    const code = [
      '#include <iostream>',
      'using namespace std;',
      '',
      'int main() {',
      '    for (int i = 0; i < 10; i++) {',
      '        cout << i << endl;',
      '    }',
      '    return 0;',
      '}',
    ].join('\n')
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('#include <iostream>')
    expect(generated).toContain('using namespace')
    expect(generated).toContain('main')
    expect(generated).toContain('for')
    expect(generated).toContain('cout')
    expect(generated).toContain('return')
  })

  it('C++ cin/cout 完整程式', async () => {
    const code = [
      '#include <iostream>',
      'using namespace std;',
      '',
      'int main() {',
      '    int x;',
      '    cin >> x;',
      '    cout << x << endl;',
      '    return 0;',
      '}',
    ].join('\n')
    const { blocks, generated } = await roundtrip(code)
    console.log('=== Blocks ===\n', JSON.stringify(blocks, null, 2))
    console.log('=== Generated ===\n', generated)
    expect(generated).toContain('cin')
    expect(generated).toContain('cout')
    expect(generated).toContain('int x')
  })
})
