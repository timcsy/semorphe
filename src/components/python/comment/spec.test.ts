/** `python:comment` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:comment', () => {
  it('★ lift：`#` 註解認得出來', async () => {
    const ids = componentIdsOf(await liftPython('# 你好\n'))
    expect(ids, '沒認出註解 → 下面會空過').toContain('python:comment')
  })

  it('🔴 round-trip 不得每次多一個 `#`', async () => {
    // 剝不掉語法符號的話，來回一次就變成 `# # 你好`
    expect(gen(await liftPython('# 你好\n'))).toBe('# 你好')
    expect(gen(await liftPython('#沒有空白\n')), '只剝一個空白，沒有的話不亂剝').toBe('# 沒有空白')
  })
})
