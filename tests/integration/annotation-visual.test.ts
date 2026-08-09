import { describe, it, expect } from 'vitest'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode, Annotation } from '../../src/core/types'

describe('Annotations 積木可見 — extraState.annotations 傳遞', () => {
  function wrapInProgram(...nodes: SemanticNode[]): SemanticNode {
    return createNode('cpp:program', {}, { body: nodes })
  }

  it('行內 annotation 應傳遞到 extraState.annotations', () => {
    const node = createNode('raw_code', { code: 'int x = 1;' })
    node.metadata = { rawCode: 'int x = 1;' }
    node.annotations = [{ type: 'comment', text: '// set x', position: 'inline' }]
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.annotations).toBeDefined()
    const annotations = block.extraState!.annotations as Annotation[]
    expect(annotations).toHaveLength(1)
    expect(annotations[0].text).toBe('// set x')
    expect(annotations[0].position).toBe('inline')
  })

  it('無 annotation 的節點不應有 extraState.annotations', () => {
    const node = createNode('raw_code', { code: 'int y = 2;' })
    node.metadata = { rawCode: 'int y = 2;' }
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.annotations).toBeUndefined()
  })

  it('多個 annotations 應全部傳遞', () => {
    const node = createNode('raw_code', { code: 'int z = 3;' })
    node.metadata = { rawCode: 'int z = 3;' }
    node.annotations = [
      { type: 'comment', text: '// first', position: 'inline' },
      { type: 'comment', text: '// second', position: 'after' },
    ]
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    const annotations = block.extraState!.annotations as Annotation[]
    expect(annotations).toHaveLength(2)
  })
})
