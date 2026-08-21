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

/**
 * 🔴 **起始的序號**（2026-08-22）。列印編號時最常見的寫法，
 * 而忽略它的症狀是**每一個編號都少一**：不報錯、有輸出。
 */
describe('起始序號', () => {
  it('🔴 位置引數與具名引數都要收', async () => {
    const out = await runPython('names = ["甲", "乙"]\nfor i, n in enumerate(names, 1):\n    print(i, n)\nprint(list(enumerate(names, start=10)))\n')
    expect(out).toContain('1 甲\n2 乙')
    expect(out).toContain("[(10, '甲'), (11, '乙')]")
  })

  it('★ 對照組：沒給的時候仍然從 0 開始', async () => {
    expect(await runPython('print(list(enumerate(["a"])))\n')).toContain("[(0, 'a')]")
  })
})
