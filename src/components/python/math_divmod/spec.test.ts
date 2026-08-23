/**
 * `python:math_divmod` 的規格。
 *
 * ⚠️ 每條負向前面先釘一個正向：`lift` 回 `null` 時集合是空的，
 * **負向斷言會空過**，而空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython as gen, componentIdsOf, runPython } from '../../../../tests/helpers/python-lift'

const CODE = "print(divmod(17, 5))\n"

describe('python:math_divmod', () => {
  it('lift：拿得到自己的身分，而不是掉進通用桶', async () => {
    const ids = componentIdsOf(await liftPython(CODE))
    expect(ids).toContain('python:math_divmod')          // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('python:func_call')
  })

  it('generate ＋ round-trip：一字不差', async () => {
    expect(gen(await liftPython(CODE)).trimEnd()).toBe(CODE.trimEnd())
  })

  it('execute：與真的 Python 同一個答案', async () => {
    expect(await runPython(CODE)).toContain("(3, 2)")
  })

  it('★ 邊界：別的呼叫不得被認走', async () => {
    const ids = componentIdsOf(await liftPython("print(abs(-1))\n"))
    expect(ids.length).toBeGreaterThan(1)   // ← 正向錨點：真的抬升到東西了
    expect(ids).not.toContain('python:math_divmod')
  })
})
