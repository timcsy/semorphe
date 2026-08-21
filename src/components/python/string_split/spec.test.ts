/** `python:string_split` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

/**
 * 🔴 **不帶引數的 `split()`**（2026-08-22）。讀一行拆數字時最常見的寫法，
 * 而它之前掉進通用桶。
 */
describe('不帶引數', () => {
  it('★ lift ＋ round-trip：兩種形狀不得混在一起', async () => {
    for (const code of ['a = s.split()\n', 'a = s.split(",")\n']) {
      expect(componentIdsOf(await liftPython(code)), code.trim()).toContain('python:string_split')
      expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    }
  })

  it('🔴 execute：不帶引數會【丟掉頭尾的空段】，帶引數的不會', async () => {
    expect(await runPython('print("  a b  ".split())\n')).toContain("['a', 'b']")
    expect(await runPython('print(len("  a b  ".split(" ")))\n'), '帶引數的有六格').toContain('6')
  })
})
