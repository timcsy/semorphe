/** `python:member_assign` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:member_assign', () => {
  it('★ lift ＋ round-trip', async () => {
    const code = 'self.name = n\n'
    expect(componentIdsOf(await liftPython(code))).toContain('python:member_assign')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('★ 對照組：裸名字的指派仍然走一般指派', async () => {
    expect(componentIdsOf(await liftPython('name = n\n'))).not.toContain('python:member_assign')
  })

  it('🔴 execute：寫進物件的欄位，而不是建一個叫 `self.name` 的變數', async () => {
    const out = await runPython(
      'class Dog:\n    def __init__(self, name):\n        self.name = name\n\n    def bark(self):\n        return self.name + " 汪"\n\nd = Dog("小黑")\nprint(d.bark())\nd.name = "小白"\nprint(d.name)\n',
    )
    expect(out).toContain('小黑 汪')
    expect(out, '從外面改欄位').toContain('小白')
  })

  it('🔴 execute：接收者是一個運算式，不是一個名字', async () => {
    const out = await runPython(
      'class C:\n    def __init__(self):\n        self.n = 0\n\nxs = [C()]\nxs[0].n = 7\nprint(xs[0].n)\n',
    )
    expect(out, '接收者壓成字串的話 `xs[0]` 會變成一個變數名').toContain('7')
  })
})
