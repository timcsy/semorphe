/** `python:compare_step` 的自證測——它只活在比較鏈裡，所以每一支都從一條鏈出發。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:compare_step', () => {
  it('★ lift：第三段起每一段一顆', async () => {
    const ids = componentIdsOf(await liftPython('y = 0 < x < 20 != 21 < 99\n'))
    expect(ids).toContain('python:compare_chain')
    expect(ids.filter((i) => i === 'python:compare_step').length).toBe(2)
  })

  it('🔴 兩段的鏈沒有它（對照組）', async () => {
    const ids = componentIdsOf(await liftPython('y = 0 < x < 20\n'))
    expect(ids).toContain('python:compare_chain')
    expect(ids).not.toContain('python:compare_step')
  })

  it('generate：值那一格照鏈的規則加括號', async () => {
    const c = 'y = 0 < x < 20 != (a < b)'
    expect(gen(await liftPython(c + '\n')).trimEnd()).toBe(c)
  })

  it('🔴 execute：中間每一格只求值一次、前一段不成立就不再算', async () => {
    const out = await runPython('def f(v):\n    print("算", v)\n    return v\n\nprint(0 < f(5) < f(20) != f(21))\nprint(0 < f(5) < f(1) != f(21))\n')
    expect(out).toBe('completed|算 5\n算 20\n算 21\nTrue\n算 5\n算 1\nFalse\n')
  })
})
