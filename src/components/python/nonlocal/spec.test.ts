/** `python:nonlocal` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'

// ⚠️ 寫成產生器的正規形（函式本體裡不留空行），來回才比得了一字不差
const counter = 'def make():\n    count = 0\n    def bump():\n        nonlocal count\n        count += 1\n        return count\n    return bump\nb = make()\nb()\nprint(b(), b())\n'

describe('python:nonlocal', () => {
  it('★ lift ＋ round-trip', async () => {
    const t = await liftPython(counter)
    expect(componentIdsOf(t)).toContain('python:nonlocal')
    expect(componentIdsOf(t)).not.toContain('unresolved')
    expect(gen(t).trimEnd()).toBe(counter.trimEnd())
  })

  it('🔴 一次宣告多個名字走誠實降級——積木上只有一格', async () => {
    const ok = 'def f():\n    a = 1\n\n    def g():\n        nonlocal a\n        a = 2\n'
    expect(componentIdsOf(await liftPython(ok))).toContain('python:nonlocal')
    const many = 'def f():\n    a = b = 1\n\n    def g():\n        nonlocal a, b\n        a = 2\n'
    expect(componentIdsOf(await liftPython(many))).not.toContain('python:nonlocal')
  })

  it('🔴 執行（Cella）：改的是外面那層函式的變數', async () => {
    await expectCellaOut(counter, '2 3\n', { lang: 'python' })
  })

  it('★ 對照組：沒有這一行時，內層的指派是自己的新變數', async () => {
    await expectCellaOut('def f():\n    x = 1\n\n    def g():\n        x = 2\n        return x\n\n    return g(), x\n\nprint(f())\n', '(2, 1)\n', { lang: 'python' })
  })
})
