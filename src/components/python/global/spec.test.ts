/** `python:global` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:global', () => {
  it('★ lift ＋ round-trip', async () => {
    const code = 'global count\n'
    expect(componentIdsOf(await liftPython(code))).toContain('python:global')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 一次宣告多個名字走誠實降級——積木上只有一格', async () => {
    expect(componentIdsOf(await liftPython('global a, b\n'))).not.toContain('python:global')
  })

  it('🔴 execute：改的是最外層那一個', async () => {
    const out = await runPython('count = 0\n\ndef bump():\n    global count\n    count += 1\n\nbump()\nbump()\nprint(count)\n')
    expect(out, '沒有它的話函式裡的指派會建立一個只活在函式裡的新變數').toContain('2')
  })

  it('★ 對照組：沒有這一行時，外面那個不動', async () => {
    expect(await runPython('x = 10\n\ndef f():\n    x = 20\n    return x\n\nprint(f(), x)\n')).toContain('20 10')
  })

  it('🔴 execute：最外層還沒有那個名字時要先建', async () => {
    expect(await runPython('def f():\n    global total\n    total = 7\n\nf()\nprint(total)\n')).toContain('7')
  })
})
