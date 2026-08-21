/** `python:assert` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:assert', () => {
  it('★ lift ＋ round-trip：兩種形狀都認得，而沒有訊息時不得產出逗號', async () => {
    for (const code of ['assert n > 0\n', 'assert n > 0, "不能是負的"\n']) {
      expect(componentIdsOf(await liftPython(code))).toContain('python:assert')
      expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    }
  })

  it('🔴 execute：成立時什麼都不做', async () => {
    expect(await runPython('assert 1 == 1\nprint("繼續")\n')).toContain('繼續')
  })

  it('🔴 execute：不成立時當場停下來，並說出使用者寫的那句話', async () => {
    const out = await runPython('assert 1 == 2, "不相等"\nprint("不該跑到這")\n')
    expect(out).toContain('不相等')
    expect(out).not.toContain('不該跑到這')
  })

  it('🔴 訊息是一個運算式，不是一個字串欄位', async () => {
    const out = await runPython('n = 5\ntry:\n    assert n < 0, f"{n} 不能是正的"\nexcept AssertionError as e:\n    print(e)\n')
    expect(out).toContain('5 不能是正的')
  })
})
