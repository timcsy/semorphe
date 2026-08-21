/** `python:map_iter` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:map_iter', () => {
  it('★ lift：三種都認得出來', async () => {
    const ids = componentIdsOf(await liftPython('d.items()\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:map_iter')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'd = {"a": 1}\nfor k, v in d.items():\n    print(k, v)\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:map_iter')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：項目是成對的，而它是 tuple', async () => {
    expect(await runPython('d = {"a": 1}\nprint(list(d.items()))\n')).toContain("[('a', 1)]")
  })

  it('🔴 execute：鍵與值也能各自取出來', async () => {
    expect(await runPython('d = {"a": 1, "b": 2}\nprint(list(d.keys()), list(d.values()))\n')).toContain("['a', 'b'] [1, 2]")
  })

})
