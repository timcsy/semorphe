/**
 * `python:negate` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:negate', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('-a'))
    expect(ids, '沒認出取負 → 下面會空過').toContain('python:negate')
    expect(ids).not.toContain('cpp:negate')
  })

  it('★ generate：負號【不】加空格（它是符號不是單字）', async () => {
    expect(gen(await liftPython('-a'))).toBe('-a')
  })

  it('⚠️ `~`（位元反相）刻意沒路由 → 不得被認成取負', async () => {
    expect(componentIdsOf(await liftPython('~a'))).not.toContain('python:negate')
  })
})
