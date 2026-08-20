/** `python:loop_for` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:loop_for', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('for i in range(3):\n    print(i)\n'))
    expect(ids, '沒認出 for → 下面會空過').toContain('python:loop_for')
    expect(ids, '⚠️ 撿到 C++ 那顆三格式的 for 了').not.toContain('cpp:loop_for')
  })

  it('🔴 `range(3)` 進的是【可走訪】那個插槽，不是一個次數欄位', async () => {
    const ids = componentIdsOf(await liftPython('for i in range(3):\n    print(i)\n'))
    expect(ids, 'range(...) 該是一顆呼叫積木').toContain('python:func_call')
  })

  it('★ generate ＋ round-trip', async () => {
    expect(gen(await liftPython('for i in range(3):\n    print(i)\n')))
      .toBe('for i in range(3):\n    print(i)')
  })

  it('★ 走訪的不是 range 時也產得回去（它只是一個運算式）', async () => {
    expect(gen(await liftPython('for c in name:\n    print(c)\n')))
      .toBe('for c in name:\n    print(c)')
  })
})
