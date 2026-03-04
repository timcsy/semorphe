import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { BlockRegistry } from '../../src/core/block-registry'
import { STYLE_PRESETS } from '../../src/languages/style'
import type { CodingStyle } from '../../src/languages/style'
import type { SemanticModel } from '../../src/core/semantic-model'
import type { BlockSpec } from '../../src/core/types'

let parser: CppParser
let adapter: CppLanguageAdapter
let generator: CppGenerator

beforeAll(async () => {
  parser = new CppParser()
  await parser.init()
  adapter = new CppLanguageAdapter()
  const registry = new BlockRegistry()
  const universalBlocks = (await import('../../src/blocks/universal.json')).default
  const basicBlocks = (await import('../../src/languages/cpp/blocks/basic.json')).default
  const advancedBlocks = (await import('../../src/languages/cpp/blocks/advanced.json')).default
  const specialBlocks = (await import('../../src/languages/cpp/blocks/special.json')).default
  for (const spec of [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]) {
    registry.register(spec)
  }
  generator = new CppGenerator(registry, adapter)
})

describe('T043: CodingStyle presets', () => {
  it('should have 3 presets: apcs, competitive, google', () => {
    expect(STYLE_PRESETS.apcs).toBeDefined()
    expect(STYLE_PRESETS.competitive).toBeDefined()
    expect(STYLE_PRESETS.google).toBeDefined()
  })

  it('apcs preset should use iostream and camelCase', () => {
    const style = STYLE_PRESETS.apcs
    expect(style.ioPreference).toBe('iostream')
    expect(style.namingConvention).toBe('camelCase')
    expect(style.indent).toBe(4)
    expect(style.useNamespaceStd).toBe(true)
  })

  it('competitive preset should use cstdio and snake_case', () => {
    const style = STYLE_PRESETS.competitive
    expect(style.ioPreference).toBe('cstdio')
    expect(style.namingConvention).toBe('snake_case')
    expect(style.useNamespaceStd).toBe(true)
  })

  it('google preset should use iostream, snake_case, 2-space indent', () => {
    const style = STYLE_PRESETS.google
    expect(style.ioPreference).toBe('iostream')
    expect(style.namingConvention).toBe('snake_case')
    expect(style.indent).toBe(2)
    expect(style.useNamespaceStd).toBe(false)
  })
})

describe('T043: Style switching - code generation', () => {
  async function parseCode(code: string): Promise<SemanticModel> {
    return parser.parseToModel(code, adapter)
  }

  it('should generate cout with apcs style', async () => {
    const model = await parseCode(`#include <iostream>
void f() {
    cout << 42 << endl;
}`)
    const code = generator.generateFromModel(model, STYLE_PRESETS.apcs)
    expect(code).toContain('cout')
    expect(code).toContain('endl')
  })

  it('should generate with 4-space indent for apcs', async () => {
    const model = await parseCode(`void f() {
    int x = 5;
}`)
    const code = generator.generateFromModel(model, STYLE_PRESETS.apcs)
    // Should have 4-space indentation inside function body
    expect(code).toMatch(/^    int x/m)
  })

  it('should generate with 2-space indent for google style', async () => {
    const model = await parseCode(`void f() {
    int x = 5;
}`)
    const code = generator.generateFromModel(model, STYLE_PRESETS.google)
    expect(code).toMatch(/^  int x/m)
  })
})

describe('T043: detectStyle', () => {
  it('should detect iostream IO preference', () => {
    const style = parser.detectStyle(`
#include <iostream>
int main() {
    cout << "hello" << endl;
    return 0;
}`)
    expect(style.ioPreference).toBe('iostream')
  })

  it('should detect cstdio IO preference', () => {
    const style = parser.detectStyle(`
#include <cstdio>
int main() {
    printf("hello\\n");
    return 0;
}`)
    expect(style.ioPreference).toBe('cstdio')
  })

  it('should detect 4-space indent', () => {
    const style = parser.detectStyle(`int main() {
    int x = 5;
    return 0;
}`)
    expect(style.indent).toBe(4)
  })

  it('should detect 2-space indent', () => {
    const style = parser.detectStyle(`int main() {
  int x = 5;
  return 0;
}`)
    expect(style.indent).toBe(2)
  })

  it('should detect bits/stdc++.h header style', () => {
    const style = parser.detectStyle(`#include <bits/stdc++.h>
int main() {
    return 0;
}`)
    expect(style.headerStyle).toBe('bits')
  })

  it('should detect using namespace std', () => {
    const style = parser.detectStyle(`using namespace std;
int main() {
    return 0;
}`)
    expect(style.useNamespaceStd).toBe(true)
  })
})

describe('T043: Style does not change blocks', () => {
  it('same semantic model generates different code with different styles', async () => {
    const model = await parser.parseToModel(`void f() {
    int x = 5;
}`, adapter)

    const apcsCode = generator.generateFromModel(model, STYLE_PRESETS.apcs)
    const googleCode = generator.generateFromModel(model, STYLE_PRESETS.google)

    // Both should contain same semantic content
    expect(apcsCode).toContain('int x = 5')
    expect(googleCode).toContain('int x = 5')

    // But different indentation
    expect(apcsCode).toMatch(/^    int x/m)
    expect(googleCode).toMatch(/^  int x/m)
  })
})
