import { describe, it, expect } from 'vitest'
import { createNode } from '../../src/core/semantic-tree'
import { generateCode, generateNode, type GeneratorContext, type NodeGenerator, setDependencyResolver, setProgramScaffold, setScaffoldConfig } from '../../src/core/projection/code-generator'
import { registerStatementGenerators } from '../../src/languages/cpp/core/generators/statements'
import { registerDeclarationGenerators } from '../../src/languages/cpp/core/generators/declarations'
import { registerExpressionGenerators } from '../../src/languages/cpp/core/generators/expressions'
import { registerIostreamGenerators } from '../../src/languages/cpp/std/iostream/generators'
import { registerCstdioGenerators } from '../../src/languages/cpp/std/cstdio/generators'
import { registerGenerators as registerVectorGenerators } from '../../src/languages/cpp/std/vector/generators'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { CppScaffold } from '../../src/languages/cpp/cpp-scaffold'
import type { StylePreset } from '../../src/core/types'
import type { ProgramScaffold, ScaffoldConfig } from '../../src/core/program-scaffold'

const apcsStyle: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

const resolver = createPopulatedRegistry()
const scaffold = new CppScaffold(resolver)

function makeGenerators(style: StylePreset): Map<string, NodeGenerator> {
  const g = new Map<string, NodeGenerator>()
  registerStatementGenerators(g, style)
  registerDeclarationGenerators(g, style)
  registerExpressionGenerators(g)
  registerIostreamGenerators(g, style)
  registerCstdioGenerators(g, style)
  registerVectorGenerators(g, style)
  return g
}

function makeCtx(style: StylePreset): GeneratorContext {
  return {
    indent: 0,
    style,
    language: 'cpp',
    generators: makeGenerators(style),
    dependencyResolver: resolver,
    programScaffold: scaffold,
    scaffoldConfig: { cognitiveLevel: 2 },
  }
}

import { registerCppLanguage } from '../../src/languages/cpp/generators'

import { generateCodeWithMapping } from '../../src/core/projection/code-generator'

describe('Auto-include via global generateCode (mimics real app path)', () => {
  it('L0: body-only tree should produce complete code with globals', () => {
    // Setup globals like app.ts init does
    registerCppLanguage()
    setDependencyResolver(resolver)
    setProgramScaffold(scaffold)
    setScaffoldConfig({ cognitiveLevel: 0 })

    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, {
          values: [createNode('string_literal', { value: 'hello' }), createNode('endl', {})],
        }),
      ],
    })

    // This is the same function called by SyncController.handleEditBlocks
    const code = generateCode(tree, 'cpp', apcsStyle)
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main() {')
    expect(code).toContain('cout')
    expect(code).toContain('return 0;')
  })

  it('L0: generateCodeWithMapping should also produce complete code', () => {
    // This is the exact function used by SyncController.handleEditBlocks
    registerCppLanguage()
    setDependencyResolver(resolver)
    setProgramScaffold(scaffold)
    setScaffoldConfig({ cognitiveLevel: 0 })

    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, {
          values: [createNode('endl', {})],
        }),
      ],
    })

    const { code } = generateCodeWithMapping(tree, 'cpp', apcsStyle)
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main() {')
    expect(code).toContain('cout << endl')
    expect(code).toContain('return 0;')
  })

  it('L0 → code should have correct line order', () => {
    registerCppLanguage()
    setDependencyResolver(resolver)
    setProgramScaffold(scaffold)
    setScaffoldConfig({ cognitiveLevel: 0 })

    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, {
          values: [createNode('string_literal', { value: 'hi' }), createNode('endl', {})],
        }),
      ],
    })

    const { code } = generateCodeWithMapping(tree, 'cpp', apcsStyle)
    const lines = code.split('\n')
    // Line 1: #include <iostream>
    expect(lines[0]).toMatch(/#include <iostream>/)
    // Line 2: using namespace std;
    expect(lines[1]).toMatch(/using namespace std;/)
    // Line 3: int main() {
    expect(lines[2]).toMatch(/int main\(\) \{/)
    // Line 4: cout << "hi" << endl;
    expect(lines[3]).toMatch(/cout/)
    // Line 5: return 0;
    expect(lines[4]).toMatch(/return 0;/)
    // Line 6: }
    expect(lines[5]).toMatch(/\}/)
  })
})

describe('Auto-include across cognitive levels', () => {
  it('L0: body-only tree should auto-include required headers via scaffold', () => {
    // L0 blocks only have body (no include/namespace/main) — scaffold wraps
    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, {
          values: [createNode('string_literal', { value: 'hello' }), createNode('endl', {})],
        }),
      ],
    })
    const ctx = { ...makeCtx(apcsStyle), scaffoldConfig: { cognitiveLevel: 0 as const } }
    const code = generateNode(tree, ctx)
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main() {')
    expect(code).toContain('cout')
    expect(code).toContain('return 0;')
  })

  it('L2: full tree with func_def(main) should auto-include via legacy path', () => {
    // L2 blocks have the full tree structure including func_def(main)
    // but user may NOT have manually added #include — auto-include should add it
    const tree = createNode('program', {}, {
      body: [
        createNode('cpp_using_namespace', { ns: 'std' }),
        createNode('func_def', { name: 'main', return_type: 'int' }, {
          body: [
            createNode('print', {}, {
              values: [createNode('string_literal', { value: 'hello' }), createNode('endl', {})],
            }),
            createNode('return', {}, { value: [createNode('number', { value: 0 })] }),
          ],
        }),
      ],
    })
    const ctx = { ...makeCtx(apcsStyle), scaffoldConfig: { cognitiveLevel: 2 as const } }
    const code = generateNode(tree, ctx)
    // Legacy path should auto-include <iostream> since no manual include exists
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main()')
    expect(code).toContain('cout')
  })

  it('L2: full tree WITH manual include should NOT duplicate', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('cpp_include', { header: 'iostream' }),
        createNode('cpp_using_namespace', { ns: 'std' }),
        createNode('func_def', { name: 'main', return_type: 'int' }, {
          body: [
            createNode('print', {}, {
              values: [createNode('string_literal', { value: 'hi' })],
            }),
            createNode('return', {}, { value: [createNode('number', { value: 0 })] }),
          ],
        }),
      ],
    })
    const ctx = { ...makeCtx(apcsStyle), scaffoldConfig: { cognitiveLevel: 2 as const } }
    const code = generateNode(tree, ctx)
    // Should appear exactly once (manual include present, auto-include deduplicates)
    const matches = code.match(/#include <iostream>/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('L0: multiple concepts should auto-include all required headers', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
      ],
    })
    const ctx = { ...makeCtx(apcsStyle), scaffoldConfig: { cognitiveLevel: 0 as const } }
    const code = generateNode(tree, ctx)
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('#include <vector>')
  })
})

describe('Scaffold-driven code generation', () => {
  it('should produce complete hello world program with scaffold', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, {
          values: [createNode('string_literal', { value: 'hello' }), createNode('endl', {})],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle))
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('using namespace std;')
    expect(code).toContain('int main() {')
    expect(code).toContain('return 0;')
    expect(code).toContain('}')
    expect(code).toContain('cout')
  })

  it('should include multiple headers in sorted order', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle))
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('#include <vector>')
    // iostream should come before vector (alphabetical)
    const iostreamIdx = code.indexOf('#include <iostream>')
    const vectorIdx = code.indexOf('#include <vector>')
    expect(iostreamIdx).toBeLessThan(vectorIdx)
  })

  it('should place scaffold in correct order: imports → preamble → entryPoint → body → epilogue', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('print', {}, { values: [createNode('string_literal', { value: 'hello' })] }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle))
    const includeIdx = code.indexOf('#include')
    const usingIdx = code.indexOf('using namespace')
    const mainIdx = code.indexOf('int main()')
    const coutIdx = code.indexOf('cout')
    const returnIdx = code.indexOf('return 0;')

    expect(includeIdx).toBeLessThan(usingIdx)
    expect(usingIdx).toBeLessThan(mainIdx)
    expect(mainIdx).toBeLessThan(coutIdx)
    expect(coutIdx).toBeLessThan(returnIdx)
  })
})
