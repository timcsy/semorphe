/** `python:container_zip` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:container_zip', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('zip(a, b)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:container_zip')
  })

  it('🔴 三串以上讓一般呼叫接手——積木上是兩格', async () => {
    const ids = componentIdsOf(await liftPython('zip(a, b, c)\n'))
    expect(ids, '認走它會產出一個對不上積木格數的呼叫').not.toContain('python:container_zip')
    expect(ids, '而它仍然要有身分').toContain('python:func_call')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'for a, b in zip(xs, ys):\n    print(a, b)\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:container_zip')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：短的那一串走完就停', async () => {
    expect(await runPython('for a, b in zip([1, 2, 3], ["x", "y"]):\n    print(a, b)\n')).toContain('1 x\n2 y')
  })

})
