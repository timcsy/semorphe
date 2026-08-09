import { describe, it, expect, beforeAll } from 'vitest'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { CONFIDENCE_VISUALS } from '../../src/ui/theme/category-colors'
import { setupTestRenderer } from '../helpers/setup-renderer'

beforeAll(() => {
  setupTestRenderer()
})

describe('Confidence 視覺回饋 — extraState.confidence 傳遞', () => {
  function wrapInProgram(...nodes: SemanticNode[]): SemanticNode {
    return createNode('cpp:program', {}, { body: nodes })
  }

  it('confidence=high 的節點不應在 extraState 中設定 confidence', () => {
    const node = createNode('raw_code', { code: 'int x = 5;' })
    node.metadata = { rawCode: 'int x = 5;', confidence: 'high' }
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    // high 是預設值，不需在 extraState 中攜帶
    expect(block.extraState?.confidence).toBeUndefined()
  })

  it('confidence=warning 的節點應攜帶 extraState.confidence=warning', () => {
    const node = createNode('raw_code', { code: 'some_wrapper(42);' })
    node.metadata = { rawCode: 'some_wrapper(42);', confidence: 'warning' }
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.confidence).toBe('warning')
  })

  it('confidence=inferred 的節點應攜帶 extraState.confidence=inferred', () => {
    const node = createNode('raw_code', { code: 'auto x = foo();' })
    node.metadata = { rawCode: 'auto x = foo();', confidence: 'inferred' }
    const tree = wrapInProgram(node)
    const state = renderToBlocklyState(tree)
    const block = state.blocks.blocks[0]
    expect(block.extraState?.confidence).toBe('inferred')
  })

  it('CONFIDENCE_VISUALS warning 應有黃色邊框', () => {
    expect(CONFIDENCE_VISUALS.warning.borderColour).toBe('#FFC107')
  })

  it('CONFIDENCE_VISUALS inferred 應有虛線邊框和降低透明度', () => {
    expect(CONFIDENCE_VISUALS.inferred.borderStyle).toBe('dashed')
    expect(CONFIDENCE_VISUALS.inferred.opacity).toBe(0.85)
  })

  it('CONFIDENCE_VISUALS high 應無額外裝飾', () => {
    expect(CONFIDENCE_VISUALS.high.borderStyle).toBe('none')
    expect(CONFIDENCE_VISUALS.high.tooltipKey).toBeNull()
  })
})
