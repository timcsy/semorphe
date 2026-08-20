/**
 * `python:logic_not` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:logic_not', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('not a'))
    expect(ids, '沒認出 not → 下面會空過').toContain('python:logic_not')
    expect(ids).not.toContain('cpp:logic_not')
  })

  it('★ generate：`not` 後面一定要一個空格（它是單字不是符號）', async () => {
    expect(gen(await liftPython('not a'))).toBe('not a')
  })

  it('🔴 優先級 7：`not a == b` 是 `not (a == b)`——不得多加括號', async () => {
    expect(gen(await liftPython('not a == b'))).toBe('not a == b')
  })
})
