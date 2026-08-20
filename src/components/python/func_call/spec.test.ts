/** `python:func_call` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:func_call', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('add(1, 2)\n'))
    expect(ids, '沒認出呼叫 → 下面會空過').toContain('python:func_call')
  })

  it('🔴 print／input 要先被認走——它們有自己的元件', async () => {
    expect(componentIdsOf(await liftPython('print("hi")\n')),
      '⚠️ 被兜底的呼叫接走了 → 優先級不對').not.toContain('python:func_call')
    expect(componentIdsOf(await liftPython('x = input()\n')))
      .not.toContain('python:func_call')
  })

  it('★ generate ＋ round-trip：語句與運算式兩個位置', async () => {
    expect(gen(await liftPython('add(1, 2)\n'))).toBe('add(1, 2)')
    expect(gen(await liftPython('x = add(1, 2)\n'))).toBe('x = add(1, 2)')
  })

  it('★ 零引數也走得完', async () => {
    expect(gen(await liftPython('reset()\n'))).toBe('reset()')
  })
})
