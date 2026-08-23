/**
 * `python:string_format` 的規格——`"{}".format(a)`。
 *
 * ⚠️ 每條負向前面先釘一個正向：`lift` 回 `null` 時集合是空的，
 * **負向斷言會空過**，而空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython as gen, componentIdsOf, runPython } from '../../../../tests/helpers/python-lift'

describe('python:string_format', () => {
  it('lift：三種寫法都拿得到身分', async () => {
    for (const code of [
      'print("{}-{}".format(1, 2))\n',
      'print("{0}{1}{0}".format("a", "b"))\n',
      'print("{n} 是 {v}".format(n="x", v=1))\n',
    ]) {
      const ids = componentIdsOf(await liftPython(code))
      expect(ids, code).toContain('python:string_format')   // ← 正向錨點
      expect(ids, code).not.toContain('raw_code')
      expect(ids, code).not.toContain('python:func_call')   // ← 不再掉進通用桶
    }
  })

  it('generate ＋ round-trip', async () => {
    const code = 'msg = "{}：{}".format("小明", 92)\nprint(msg)\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('execute：與真的 Python 同一個答案', async () => {
    expect(await runPython('print("{}-{}".format(1, 2))\n')).toContain('1-2')
    expect(await runPython('print("{0}{1}{0}".format("a", "b"))\n')).toContain('aba')
    expect(await runPython('print("{n} 是 {v}".format(n="x", v=1))\n')).toContain('x 是 1')
  })

  it('★ 邊界：不是 `format` 的方法不得被認走', async () => {
    const ids = componentIdsOf(await liftPython('print("a".upper())\n'))
    expect(ids).toContain('python:string_upper')          // ← 正向錨點
    expect(ids).not.toContain('python:string_format')
  })
})
