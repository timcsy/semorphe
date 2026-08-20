/**
 * `python:logic` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:logic', () => {
  it('★ lift：and／or 認得出來', async () => {
    const ids = componentIdsOf(await liftPython('a and b'))
    expect(ids, '沒認出邏輯運算 → 下面會空過').toContain('python:logic')
    expect(ids).not.toContain('cpp:logic')
  })

  it('★ generate ＋ round-trip', async () => {
    expect(gen(await liftPython('a and b'))).toBe('a and b')
    expect(gen(await liftPython('a or b'))).toBe('a or b')
  })

  it('🔴 優先級：and 綁得比 or 緊，所以這一個【需要】括號', async () => {
    expect(gen(await liftPython('(a or b) and c'))).toBe('(a or b) and c')
    expect(gen(await liftPython('a or b and c')), '這個不需要').toBe('a or b and c')
  })
})
