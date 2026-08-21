/** `python:break` 的自證測（spec 170，盲測抓到的缺口）。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:break', () => {
  it('★ lift：認得出來，而【不再降級】', async () => {
    const ids = componentIdsOf(await liftPython('while True:\n    break\n'))
    expect(ids, '沒認出來 → 下面會空過').toContain('python:break')
    expect(ids, '⚠️ 還在降級——盲測那兩題就是死在這裡').not.toContain('unresolved')
  })

  it('★ generate ＋ round-trip', async () => {
    const src = 'while True:\n    break\n'
    expect(gen(await liftPython(src))).toBe(src.trim())
  })

  it('🔴 執行：它是一條【跳躍的邊】，靠丟訊號實作', async () => {
    expect(await runPython(
      'n = 0\nwhile n < 5:\n    n = n + 1\n    if n == 3:\n        break\n    print(n)\n'
    )).toBe("completed|1\n2\n")
  })

  it('🔴 在 for 迴圈裡也接得住——不是只有 while', async () => {
    expect(await runPython(
      'for i in range(5):\n    if i == 2:\n        break\n    print(i)\n'
    )).toBe("completed|0\n1\n")
  })
})
