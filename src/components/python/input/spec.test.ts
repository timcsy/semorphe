/** `python:input` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:input', () => {
  it('★ lift：認得出來，而【不是】兜底的呼叫', async () => {
    const ids = componentIdsOf(await liftPython('x = input()\n'))
    expect(ids, '沒認出 input → 下面會空過').toContain('python:input')
    expect(ids).not.toContain('python:func_call')
  })

  it('🔴 沒有提示時不得被補成 `input("")`', async () => {
    expect(gen(await liftPython('x = input()\n'))).toBe('x = input()')
  })

  it('★ 帶提示的也走得完', async () => {
    expect(gen(await liftPython('x = input("名字：")\n'))).toBe('x = input("名字：")')
  })
})
