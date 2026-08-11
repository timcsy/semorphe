import { describe, it, expect } from 'vitest'
import { createNode } from '../../src/core/semantic-tree'
import { generateNode, type GeneratorContext, type NodeGenerator } from '../../src/core/projection/code-generator'
import { registerStatementGenerators } from '../../src/languages/cpp/core/generators/statements'
import { registerDeclarationGenerators } from '../../src/languages/cpp/core/generators/declarations'
import { registerIostreamGenerators } from '../../src/languages/cpp/std/iostream/generators'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import type { StylePreset } from '../../src/core/types'
import { createCppGenerators } from '../../src/languages/cpp/generators'

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

/**
 * ⚠️ **不要自己組裝產生器 map**（`scaffold-codegen` 已經改過同一件事）。
 * 手列 registrar 會漏掉 `componentGenerateRegistrars()`，症狀是
 * `⟨unknown concept: cpp:print_formatted⟩`——看起來像產生器不見了。
 */
function makeGenerators(style: StylePreset): Map<string, NodeGenerator> {
  return createCppGenerators(style)
}

function makeCtx(style: StylePreset, withRegistry = false): GeneratorContext {
  return {
    indent: 0,
    style,
    language: 'cpp',
    generators: makeGenerators(style),
    dependencyResolver: withRegistry ? createPopulatedRegistry() : undefined,
  }
}

describe('Auto-include integration', () => {
  it('should auto-inject #include <iostream> for cout code', () => {
    const tree = createNode('cpp:program', {}, {
      body: [
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, {
              values: [createNode('cpp:literal_string', { value: 'hello' }), createNode('cpp:endl', {})],
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
    const tree = createNode('cpp:program', {}, {
      body: [
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print_formatted', { format: '%d\\n' }, { args: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(competitiveStyle, true))
    expect(code).toContain('#include <cstdio>')
    expect(code).toContain('printf')
  })

  it('should NOT duplicate manually placed #include', () => {
    const tree = createNode('cpp:program', {}, {
      body: [
        createNode('cpp:include', { header: 'iostream', local: false }),
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, true))
    const matches = code.match(/#include <iostream>/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('should NOT inject includes when no dependencyResolver provided', () => {
    const tree = createNode('cpp:program', {}, {
      body: [
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, false))
    expect(code).not.toContain('#include')
  })

  it('should inject multiple headers for mixed concepts', () => {
    const tree = createNode('cpp:program', {}, {
      body: [
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
            createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ],
    })
    const code = generateNode(tree, makeCtx(apcsStyle, true))
    expect(code).toContain('#include <iostream>')
    expect(code).toContain('#include <vector>')
  })
})
