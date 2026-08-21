/** `python:string_replace` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:string_replace', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('s.replace("a", "b")\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:string_replace')
  })

  it('🔴 三個引數的讓一般方法呼叫接手——積木上沒有「最多換幾次」那一格', async () => {
    const ids = componentIdsOf(await liftPython('s.replace("a", "b", 1)\n'))
    expect(ids, '認走它會產出一個對不上積木格數的呼叫').not.toContain('python:string_replace')
    expect(ids, '而它仍然要有身分').toContain('python:method_call')
  })

  it('generate ＋ round-trip', async () => {
    const code = 't = "a,b"\nprint(t.replace(",", " "))\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:string_replace')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：所有出現的都換掉，原本的不變', async () => {
    expect(await runPython('s = "aXaXa"\nprint(s.replace("X", "-"), s)\n')).toContain('a-a-a aXaXa')
  })

})
