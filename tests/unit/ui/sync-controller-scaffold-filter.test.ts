/**
 * TDD tests for Phase B Item 5: stripScaffoldNodes → language module injection
 *
 * After refactoring, SyncController should use an injected scaffold node filter
 * instead of the hardcoded stripScaffoldNodes function.
 */
import { describe, it, expect } from 'vitest'
import { createNode } from '../../../src/core/semantic-tree'
import { cppStripScaffoldNodes } from '../../../src/languages/cpp/cpp-scaffold-filter'
import type { SemanticNode } from '../../../src/core/types'

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

describe('cppStripScaffoldNodes (moved from sync-controller)', () => {
  it('strips include directives', () => {
    const tree = makeProgram([
      createNode('cpp_include', { header: 'iostream' }),
      createNode('var_declare', { name: 'x', type: 'int' }),
    ])
    const result = cppStripScaffoldNodes(tree)
    expect(result.children.body).toHaveLength(1)
    expect(result.children.body[0].concept).toBe('var_declare')
  })

  it('strips using namespace', () => {
    const tree = makeProgram([
      createNode('cpp_using_namespace', { namespace: 'std' }),
      createNode('print', {}),
    ])
    const result = cppStripScaffoldNodes(tree)
    expect(result.children.body).toHaveLength(1)
    expect(result.children.body[0].concept).toBe('print')
  })

  it('unwraps func_def main body and skips return', () => {
    const tree = makeProgram([
      createNode('func_def', { name: 'main', return_type: 'int' }, {
        body: [
          createNode('var_declare', { name: 'a', type: 'int' }),
          createNode('return', {}),
        ],
      }),
    ])
    const result = cppStripScaffoldNodes(tree)
    expect(result.children.body).toHaveLength(1)
    expect(result.children.body[0].concept).toBe('var_declare')
  })

  it('keeps user-defined functions', () => {
    const tree = makeProgram([
      createNode('func_def', { name: 'helper', return_type: 'void' }, { body: [] }),
      createNode('func_def', { name: 'main', return_type: 'int' }, {
        body: [createNode('print', {})],
      }),
    ])
    const result = cppStripScaffoldNodes(tree)
    expect(result.children.body).toHaveLength(2)
    expect(result.children.body[0].concept).toBe('func_def')
    expect(result.children.body[0].properties.name).toBe('helper')
    expect(result.children.body[1].concept).toBe('print')
  })

  it('strips cpp_include_local too', () => {
    const tree = makeProgram([
      createNode('cpp_include_local', { header: 'mylib.h' }),
      createNode('print', {}),
    ])
    const result = cppStripScaffoldNodes(tree)
    expect(result.children.body).toHaveLength(1)
  })
})
