import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { BlockRegistry } from '../../src/core/block-registry'
import { semanticEquals } from '../../src/core/semantic-model'
import { STYLE_PRESETS } from '../../src/languages/style'
import type { SemanticModel } from '../../src/core/semantic-model'

/**
 * T017: Round-trip integration tests
 * Verifies: parse(generate(S)) ≡ S (semantic equivalence ignoring metadata)
 */

let parser: CppParser
let adapter: CppLanguageAdapter
let generator: CppGenerator
const style = STYLE_PRESETS.apcs

beforeAll(async () => {
  parser = new CppParser()
  await parser.init()
  adapter = new CppLanguageAdapter()
  const registry = new BlockRegistry()
  const universalBlocks = (await import('../../src/blocks/universal.json')).default
  const basicBlocks = (await import('../../src/languages/cpp/blocks/basic.json')).default
  const advancedBlocks = (await import('../../src/languages/cpp/blocks/advanced.json')).default
  const specialBlocks = (await import('../../src/languages/cpp/blocks/special.json')).default
  for (const spec of [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as any[]) {
    registry.register(spec)
  }
  generator = new CppGenerator(registry, adapter)
})

async function roundTrip(code: string): Promise<{ model1: SemanticModel; model2: SemanticModel; regenerated: string }> {
  const model1 = await parser.parseToModel(code, adapter)
  const regenerated = generator.generateFromModel(model1, style)
  const model2 = await parser.parseToModel(regenerated, adapter)
  return { model1, model2, regenerated }
}

describe('T017: Round-trip — parse(generate(S)) ≡ S', () => {
  it('simple variable declaration', async () => {
    const { model1, model2 } = await roundTrip('int x = 42;')
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('variable assignment', async () => {
    const { model1, model2 } = await roundTrip('x = 10;')
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('arithmetic expression', async () => {
    const { model1, model2 } = await roundTrip('int x = 3 + 5;')
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('function definition with body', async () => {
    const code = `int main() {
    int x = 5;
    return x;
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('if-else statement', async () => {
    const code = `void f() {
    if (x > 0) {
        int a = 1;
    } else {
        int b = 2;
    }
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('counting for loop', async () => {
    const code = `void f() {
    for (int i = 0; i <= 10; i++) {
        break;
    }
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('while loop', async () => {
    const code = `void f() {
    while (x > 0) {
        x = x - 1;
    }
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('function call with arguments', async () => {
    const code = `void f() {
    add(1, x);
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('cout print with endl', async () => {
    const code = `#include <iostream>
void f() {
    cout << 42 << endl;
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('cin input', async () => {
    const code = `#include <iostream>
void f() {
    cin >> x;
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('array declaration', async () => {
    const { model1, model2 } = await roundTrip('int arr[10];')
    expect(semanticEquals(model1, model2)).toBe(true)
  })

  it('complex program', async () => {
    const code = `#include <iostream>
int main() {
    int n = 0;
    cin >> n;
    for (int i = 1; i <= n; i++) {
        cout << i << endl;
    }
    return 0;
}`
    const { model1, model2 } = await roundTrip(code)
    expect(semanticEquals(model1, model2)).toBe(true)
  })
})

describe('T017: BlockJSON round-trip — fromBlockJSON(toBlockJSON(S)) ≡ S', () => {
  it('var_declare round-trip through BlockJSON', async () => {
    const model = await parser.parseToModel('int x = 5;', adapter)
    const body = model.program.children.body as any[]
    const original = body[0]

    const blockJson = adapter.toBlockJSON(original)
    const restored = adapter.fromBlockJSON(blockJson)

    expect(restored).not.toBeNull()
    const { nodeEquals } = await import('../../src/core/semantic-model')
    expect(nodeEquals(original, restored!)).toBe(true)
  })

  it('func_def round-trip through BlockJSON', async () => {
    const model = await parser.parseToModel('int add(int a, int b) { return a + b; }', adapter)
    const body = model.program.children.body as any[]
    const original = body[0]

    const blockJson = adapter.toBlockJSON(original)
    const restored = adapter.fromBlockJSON(blockJson)

    expect(restored).not.toBeNull()
    const { nodeEquals } = await import('../../src/core/semantic-model')
    expect(nodeEquals(original, restored!)).toBe(true)
  })
})
