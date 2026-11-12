/** `python:container_erase` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:container_erase', () => {
  it('★ lift ＋ round-trip', async () => {
    for (const code of ['del d["a"]\n', 'del xs[0]\n']) {
      expect(componentIdsOf(await liftPython(code))).toContain('python:container_erase')
      expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    }
  })

  // 423 之前 `del x` 走誠實降級；423 起它歸 `python:delete`（刪掉一個名字），這一顆只收「刪容器的一格」
  it('`del x`（刪掉一個變數）不是這一顆，是 python:delete', async () => {
    const ids = componentIdsOf(await liftPython('del x\n'))
    expect(ids).toContain('python:delete')
    expect(ids).not.toContain('python:container_erase')
  })

  it('🔴 execute：字典少一個鍵、串列少一格而後面往前遞補', async () => {
    expect(await runPython('d = {"a": 1, "b": 2}\ndel d["a"]\nprint(d)\n')).toContain("{'b': 2}")
    expect(await runPython('xs = [1, 2, 3]\ndel xs[0]\nprint(xs)\n')).toContain('[2, 3]')
  })

  it('🔴 execute：刪一個不存在的要停下來', async () => {
    expect(await runPython('d = {"a": 1}\ndel d["z"]\n')).toMatch(/例外|錯誤|Error/)
  })
})
