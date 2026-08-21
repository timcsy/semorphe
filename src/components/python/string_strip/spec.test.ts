/** `python:string_strip` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:string_strip', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython("'  hi  '.strip()\n"))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:string_strip')
  })

  it('🔴 有引數的讓一般方法呼叫接手——`s.strip("x")` 去掉的是指定字元', async () => {
    const ids = componentIdsOf(await liftPython('s.strip("x")\n'))
    expect(ids, '認走它會產出一個對不上積木格數的呼叫').not.toContain('python:string_strip')
    expect(ids, '而它仍然要有身分').toContain('python:method_call')
  })

  it('generate ＋ round-trip', async () => {
    const code = 's = "  hi  "\nprint(s.strip())\n'
    expect(componentIdsOf(await liftPython(code)), '沒認出來 → 來回比對是空過').toContain('python:string_strip')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：只去頭尾，中間的空白不動', async () => {
    expect(await runPython('print("  a b  ".strip() + "|")\n')).toContain('a b|')
  })

})
