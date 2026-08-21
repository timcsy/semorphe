/** `python:map_at_default` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:map_at_default', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('d.get("z", 0)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:map_at_default')
  })

  it('★ lift：只有一個引數的也認得', async () => {
    const ids = componentIdsOf(await liftPython('d.get("z")\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:map_at_default')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'd = {"a": 1}\nprint(d.get("z", 0))\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:map_at_default')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：查不到不會停下來，給備用的值', async () => {
    expect(await runPython('d = {"a": 1}\nprint(d.get("z", 0))\n')).toContain('0')
  })

  it('🔴 execute：查得到就給查到的', async () => {
    expect(await runPython('d = {"a": 1}\nprint(d.get("a", 0))\n')).toContain('1')
  })

  it('🔴 execute：沒給備用的值時查不到是 None', async () => {
    expect(await runPython('d = {"a": 1}\nprint(d.get("z"))\n')).toContain('None')
  })

  it('🔴 使用者自己的類別有同名方法時要讓路——判別在 lift 期，蓋掉是執行期的事', async () => {
    expect(await runPython('class Bag:\n    def get(self, k):\n        return 99\n\nb = Bag()\nprint(b.get("x"))\n')).toContain('99')
  })

})
