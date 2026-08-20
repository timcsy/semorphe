/** `python:loop_while` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:loop_while', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('while x > 0:\n    x = x - 1\n'))
    expect(ids, '沒認出 while → 下面會空過').toContain('python:loop_while')
    expect(ids).not.toContain('cpp:loop_while')
  })

  it('🔴 body 要接進來，不是空的', async () => {
    const ids = componentIdsOf(await liftPython('while x > 0:\n    x = x - 1\n'))
    expect(ids, 'body 沒接進來 → 迴圈裡的指派不見了').toContain('python:var_assign')
  })

  it('★ generate ＋ round-trip：縮排不是大括號', async () => {
    expect(gen(await liftPython('while x > 0:\n    x = x - 1\n')))
      .toBe('while x > 0:\n    x = x - 1')
  })
})
