/** `python:if` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:if', () => {
  it('★ lift：沒有 else 的 if 認得出來', async () => {
    const ids = componentIdsOf(await liftPython('if x > 0:\n    y = 1\n'))
    expect(ids, '沒認出 if → 下面會空過').toContain('python:if')
    expect(ids).not.toContain('cpp:if')
  })

  it('🔴 有 else 的【不】走這一筆', async () => {
    const ids = componentIdsOf(await liftPython('if x > 0:\n    y = 1\nelse:\n    y = 2\n'))
    expect(ids, '★ 錨點：if_else 要認得出來').toContain('python:if_else')
    expect(ids, '⚠️ 有 else 卻走了沒有 else 那一筆 → else 分支會被靜靜丟掉')
      .not.toContain('python:if')
  })

  it('🔴 `elif` 走【誠實降級】，不得被當成一般的 if', async () => {
    const ids = componentIdsOf(await liftPython('if a:\n    b = 1\nelif c:\n    b = 2\n'))
    expect(ids.length, '★ 錨點').toBeGreaterThan(0)
    expect(ids, '⚠️ elif 那兩個分支會被靜靜丟掉——寧可降級').not.toContain('python:if')
    expect(ids, '同上').not.toContain('python:if_else')
  })

  it('★ generate ＋ round-trip', async () => {
    expect(gen(await liftPython('if x > 0:\n    y = 1\n'))).toBe('if x > 0:\n    y = 1')
  })
})
