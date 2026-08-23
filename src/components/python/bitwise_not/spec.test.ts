/** `python:bitwise_not` 的規格——`~x`，以及同一族的移位。 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython as gen, componentIdsOf, runPython } from '../../../../tests/helpers/python-lift'

describe('python:bitwise_not', () => {
  it('lift ＋ round-trip', async () => {
    const code = 'x = 5\nprint(~x, ~(x + 1))\n'
    const ids = componentIdsOf(await liftPython(code))
    expect(ids).toContain('python:bitwise_not')     // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('execute：與真的 Python 同一個答案（沒有位寬）', async () => {
    expect(await runPython('print(~5, ~0, ~(-1))\n')).toContain('-6 -1 0')
  })

  it('🔴 移位不用 JS 的 `<<`——它會把數字截成 32 位元', async () => {
    expect(await runPython('print(1 << 40, 1 << 3, 1024 >> 3)\n')).toContain('1099511627776 8 128')
  })

  it('★ 邊界：不是整數要出聲', async () => {
    expect(await runPython('print(~1.5)\n')).toMatch(/例外|錯誤/)
    expect(await runPython('print(1 << -1)\n')).toMatch(/例外|錯誤/)
  })
})
