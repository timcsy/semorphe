/** `python:container_enumerate` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:container_enumerate', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('enumerate(xs)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:container_enumerate')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'for i, x in enumerate(xs):\n    print(i, x)\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:container_enumerate')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：序號從 0 開始', async () => {
    expect(await runPython('for i, x in enumerate(["a", "b"]):\n    print(i, x)\n')).toContain('0 a\n1 b')
  })

})
