/** `python:print` 的自證測（spec 170）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:print', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('print("hi")\n'))
    expect(ids, '沒認出輸出 → 下面會空過').toContain('python:print')
  })

  it('★ generate ＋ round-trip：多引數也一字不差', async () => {
    expect(gen(await liftPython('print("a", 1, True)\n'))).toBe('print("a", 1, True)')
  })

  it('🔴 執行：Python 的 print 用【空格】分隔並換行——與 C++ 的串接不同', async () => {
    expect(await runPython('print("a", 1)\n')).toBe('completed|a 1\n')
  })

  it('🔴 印出來的樣子與 C++ 不同的三格', async () => {
    expect(await runPython('print(True)\n'), 'C++ 印 1').toBe('completed|True\n')
    expect(await runPython('print(None)\n'), '不是空字串').toBe('completed|None\n')
    expect(await runPython('print(3.0)\n'), 'C++ 印 3').toBe('completed|3.0\n')
  })

  it('★ 反向：不亂認——`foo("hi")` 不得變成輸出', async () => {
    expect(componentIdsOf(await liftPython('foo("hi")\n'))).not.toContain('python:print')
  })
})
