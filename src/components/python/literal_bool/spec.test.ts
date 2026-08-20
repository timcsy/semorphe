/**
 * `python:literal_bool` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:literal_bool', () => {
  it('★ lift：True／False／None 都認得出來', async () => {
    for (const src of ['True', 'False', 'None']) {
      const ids = componentIdsOf(await liftPython(src))
      expect(ids, `${src} 沒認出來`).toContain('python:literal_bool')
    }
  })

  it('🔴 三個是【三種節點型別】，不是一個帶值的字面值', async () => {
    // 這一支釘的是「為什麼一顆元件要三筆 pattern」——少一筆就少一個值。
    const none = await liftPython('None')
    expect(componentIdsOf(none), 'None 掉了 → tree-sitter-python 的 `none` 是獨立節點型別')
      .toContain('python:literal_bool')
  })

  it('★ generate ＋ round-trip：三個值都一字不差', async () => {
    expect(gen(await liftPython('True'))).toBe('True')
    expect(gen(await liftPython('False'))).toBe('False')
    expect(gen(await liftPython('None'))).toBe('None')
  })
})
