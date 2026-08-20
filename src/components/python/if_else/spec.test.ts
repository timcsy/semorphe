/** `python:if_else` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:if_else', () => {
  it('★ lift：認得出來，兩個 body 都在', async () => {
    const t = await liftPython('if x > 0:\n    y = 1\nelse:\n    y = 2\n')
    const ids = componentIdsOf(t)
    expect(ids, '沒認出 if_else → 下面會空過').toContain('python:if_else')
    const find = (n: typeof t): typeof t =>
      !n ? null : n.componentId === 'python:if_else' ? n
        : Object.values(n.children ?? {}).flat().map((k) => find(k)).find(Boolean) ?? null
    const node = find(t)!
    expect(node.children.body?.length, 'then 分支空了').toBe(1)
    expect(node.children.else_body?.length,
      '🔴 else 分支空了 —— `alternative` 是 else_clause，要能穿透到它的 block').toBe(1)
  })

  it('★ generate ＋ round-trip：兩個分支都產得回去', async () => {
    expect(gen(await liftPython('if x > 0:\n    y = 1\nelse:\n    y = 2\n')))
      .toBe('if x > 0:\n    y = 1\nelse:\n    y = 2')
  })
})
