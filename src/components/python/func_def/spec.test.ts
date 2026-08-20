/** `python:func_def` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:func_def', () => {
  it('★ lift：認得出來，body 也接得進來', async () => {
    const ids = componentIdsOf(await liftPython('def add(a, b):\n    return a + b\n'))
    expect(ids, '沒認出函式定義 → 下面會空過').toContain('python:func_def')
    expect(ids, 'body 沒接進來').toContain('python:return')
  })

  it('🔴 參數列的括號要剝掉——不然會產出 `def f((a, b))`', async () => {
    expect(gen(await liftPython('def add(a, b):\n    return a\n')))
      .toBe('def add(a, b):\n    return a')
  })

  it('★ 零參數也走得完', async () => {
    expect(gen(await liftPython('def go():\n    print(1)\n')))
      .toBe('def go():\n    print(1)')
  })
})
