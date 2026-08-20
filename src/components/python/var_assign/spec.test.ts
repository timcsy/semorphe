/** `python:var_assign` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:var_assign', () => {
  it('★ lift：`x = 5` 認得出來', async () => {
    const ids = componentIdsOf(await liftPython('x = 5\n'))
    expect(ids, '沒認出指派 → 下面會空過').toContain('python:var_assign')
    expect(ids, '⚠️ 名字被當成變數參照了 → 左邊該用 text 不是 lift').not.toContain('python:var_ref')
  })

  it('★ generate ＋ round-trip：沒有型別也沒有分號', async () => {
    expect(gen(await liftPython('x = 5\n'))).toBe('x = 5')
    expect(gen(await liftPython('total = a + b * 2\n'))).toBe('total = a + b * 2')
  })

  it('🔴 有了它，運算式才碰得到——貼上的每一行都是指派', async () => {
    const ids = componentIdsOf(await liftPython('y = x + 3 * 2\n'))
    expect(ids).toContain('python:arithmetic')
    expect(ids).toContain('python:var_ref')
    expect(ids.filter((i) => i === 'unresolved'), '整句降級了').toEqual([])
  })
})
