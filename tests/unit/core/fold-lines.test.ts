/**
 * 程式碼按行摺：一行 → 從那一行開始、跨最多行的節點（spec 223；網頁版與 IDE 共用）。
 */
import { describe, it, expect } from 'vitest'
import { nodeAtStartLine, foldLinesFor } from '../../../src/core/granularity'

const M = [
  { nodeId: 'for', startLine: 2, endLine: 5 },
  { nodeId: 'cond', startLine: 2, endLine: 2 },
  { nodeId: 'init', startLine: 2, endLine: 2 },
  { nodeId: 'body1', startLine: 3, endLine: 3 },
  { nodeId: 'if', startLine: 6, endLine: 8 },
  { nodeId: 'one', startLine: 9, endLine: 9 },
]

describe('程式碼按行摺', () => {
  it('一行上取跨最多行的那顆；單行的不算', () => {
    const m = nodeAtStartLine(M)
    expect(m.get(2)).toBe('for')
    expect(m.get(6)).toBe('if')
    expect(m.has(3)).toBe(false)
    expect(m.has(9)).toBe(false)
  })
  it('要收合的節點 → 它的起始行（0 起算、排序）', () => {
    expect(foldLinesFor(new Set(['if', 'for']), M)).toEqual([2, 6])
  })
  it('單行的節點、或同一行上不是最長的那顆 → 不摺（不猜）', () => {
    expect(foldLinesFor(new Set(['one', 'cond']), M)).toEqual([])
  })
})
