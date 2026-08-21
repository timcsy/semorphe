/** `python:string_join` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:string_join', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('"-".join(xs)\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:string_join')
  })

  it('generate ＋ round-trip', async () => {
    const code = 'print("-".join(["a", "b"]))\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:string_join')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：分隔的那一段是【接收者】', async () => {
    expect(await runPython('print("-".join(["a", "b", "c"]))\n')).toContain('a-b-c')
  })

  it('★ 對照組：一格的串列不加分隔', async () => {
    expect(await runPython('print("-".join(["a"]))\n')).toContain('a')
  })

})
