import { describe, it, expect } from 'vitest'
import { createNode } from '../../src/core/semantic-tree'
import { generateNode, type GeneratorContext, type NodeGenerator } from '../../src/core/projection/code-generator'
import { registerStatementGenerators } from '../../src/languages/cpp/generators/statements'
import { registerDeclarationGenerators } from '../../src/languages/cpp/generators/declarations'
import { registerExpressionGenerators } from '../../src/languages/cpp/generators/expressions'
import { registerIostreamGenerators } from '../../src/languages/cpp/std/iostream/generators'
import { registerCstdioGenerators } from '../../src/languages/cpp/std/cstdio/generators'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import type { StylePreset } from '../../src/core/types'

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

const competitiveStyle: StylePreset = {
  id: 'competitive',
  name: { 'zh-TW': '競賽', en: 'Competitive' },
  io_style: 'printf',
  naming_convention: 'snake_case',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'bits',
}

function makeGenerators(style: StylePreset): Map<string, NodeGenerator> {
  const g = new Map<string, NodeGenerator>()
  registerStatementGenerators(g, style)
  registerDeclarationGenerators(g, style)
  registerExpressionGenerators(g)
  registerIostreamGenerators(g, style)
  registerCstdioGenerators(g, style)
  return g
}

function makeCtx(style: StylePreset, withRegistry = false): GeneratorContext {
  return {
    indent: 0,
    style,
    language: 'cpp',
    generators: makeGenerators(style),
    moduleRegistry: withRegistry ? createPopulatedRegistry() : undefined,
  }
}

describe('Auto-include integration', () => {
  it('should auto-inject #include <iostream> for cout code', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, {
              values: [createNode('string_literal', { value: 'hello' }), createNode('endl', {})],
            }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, true))
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('cout')
  })

  it('should auto-inject #include <cstdio> for printf code', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(competitiveStyle, true))
    expect(code).toContain('#include <cstdio>')
    expect(code).toContain('printf')
  })

  it('should NOT duplicate manually placed #include', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('cpp_include', { header: 'iostream', local: false }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, true))
    const matches = code.match(/#include <iostream>/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('should NOT inject includes when no moduleRegistry provided', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, false))
    expect(code).not.toContain('#include')
  })

  it('should inject multiple headers for mixed concepts', () => {
    const tree = createNode('program', {}, {
      body: [
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
            createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, true))
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('#include <vector>')
  })
})
