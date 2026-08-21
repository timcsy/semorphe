/** `python:math_round` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:math_round', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('round(x)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:math_round')
  })

  it('★ lift：帶位數的也認得', async () => {
    const ids = componentIdsOf(await liftPython('round(x, 2)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:math_round')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'print(round(2.5))\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:math_round')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：剛好在一半時往【偶數】靠', async () => {
    expect(await runPython('print(round(2.5), round(3.5), round(0.5))\n')).toContain('2 4 0')
  })

  it('🔴 execute：帶位數', async () => {
    expect(await runPython('print(round(3.14159, 2))\n')).toContain('3.14')
  })

})
