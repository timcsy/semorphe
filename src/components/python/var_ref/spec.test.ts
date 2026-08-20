/**
 * `python:var_ref` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:var_ref', () => {
  it('★ lift：`x + 1` 裡的 x 認得出來', async () => {
    const ids = componentIdsOf(await liftPython('x + 1'))
    expect(ids, '沒認出變數參照 → 下面那條會空過').toContain('python:var_ref')
    expect(ids, '⚠️ 撿到 C++ 的身分了（spec 167 的文法過濾漏了）').not.toContain('cpp:var_ref')
  })

  it('★ generate：名字原樣產回去', async () => {
    expect(gen(await liftPython('total + 1'))).toBe('total + 1')
  })

  it('★ round-trip：一字不差', async () => {
    expect(gen(await liftPython('print(count)'))).toBe('print(count)')
  })

  it('★ 反向：函式名不得被當成變數參照', async () => {
    const t = await liftPython('print("hi")')
    const ids = componentIdsOf(t)
    expect(ids, '正向錨點：print 本身要認得出來').toContain('python:print')
    expect(ids, '⚠️ `print` 這個 identifier 被當成變數了 → 兜底的優先級太高')
      .not.toContain('python:var_ref')
  })
})
