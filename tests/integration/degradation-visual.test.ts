import { describe, it, expect } from 'vitest'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { DEGRADATION_VISUALS } from '../../src/ui/theme/category-colors'

describe('降級視覺區分 — extraState.degradationCause 傳遞', () => {
  function makeRawCode(code: string, cause?: string): SemanticNode {
    const node = createNode('raw_code', { code })
    node.metadata = {
      rawCode: code,
      degradationCause: cause as SemanticNode['metadata']['degradationCause'],
    }
    return node
  }

  function wrapInProgram(...nodes: SemanticNode[]): SemanticNode {
    return createNode('lang:program', {}, { body: nodes })
  }

  it('syntax_error 節點應攜帶 degradationCause=syntax_error', () => {
    const tree = wrapInProgram(makeRawCode('int x = ;', 'syntax_error'))
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.degradationCause).toBe('syntax_error')
  })

  it('unsupported 節點應攜帶 degradationCause=unsupported', () => {
    const tree = wrapInProgram(makeRawCode('auto f = [](){};', 'unsupported'))
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.degradationCause).toBe('unsupported')
  })

  it('nonstandard_but_valid 節點應攜帶 degradationCause=nonstandard_but_valid', () => {
    const tree = wrapInProgram(makeRawCode('auto f = [](){};', 'nonstandard_but_valid'))
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.degradationCause).toBe('nonstandard_but_valid')
  })

  it('無明確 degradationCause 的 raw_code 應預設為 unsupported', () => {
    const node = createNode('raw_code', { code: 'unknown stuff' })
    node.metadata = { rawCode: 'unknown stuff' }
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.degradationCause).toBe('unsupported')
  })

  it('DEGRADATION_VISUALS 三種原因的顏色值應各不相同', () => {
    const colours = new Set([
      DEGRADATION_VISUALS.syntax_error.colour,
      DEGRADATION_VISUALS.unsupported.colour,
      DEGRADATION_VISUALS.nonstandard_but_valid.borderColour,
    ])
    expect(colours.size).toBe(3)
  })

  it('syntax_error 視覺應為紅色背景', () => {
    expect(DEGRADATION_VISUALS.syntax_error.colour).toBe('#FF6B6B')
  })

  it('unsupported 視覺應為灰色背景', () => {
    expect(DEGRADATION_VISUALS.unsupported.colour).toBe('#9E9E9E')
  })

  it('nonstandard_but_valid 視覺應為綠色邊框（不覆蓋背景色）', () => {
    expect(DEGRADATION_VISUALS.nonstandard_but_valid.colour).toBeNull()
    expect(DEGRADATION_VISUALS.nonstandard_but_valid.borderColour).toBe('#4CAF50')
  })
})
