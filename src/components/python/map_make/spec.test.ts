/** `python:map_make` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:map_make', () => {
  it('★ lift ＋ round-trip', async () => {
    const code = 'ages = {"小明": 12}\n'
    expect(componentIdsOf(await liftPython(code))).toContain('python:map_make')
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('★ execute：空字典與有內容的都印得對', async () => {
    expect(await runPython('print({})\n')).toContain('{}')
    expect(await runPython('print({"a": 1, "b": 2})\n')).toContain("{'a': 1, 'b': 2}")
  })
})


/**
 * 🔴 **鍵照它原本的型別印**（2026-08-22 參照直譯器抓到）。
 *
 * 底層的 `Map` 只吃字串，而 `{1: 1}` 曾經印成 `{'1': 1}`
 * ——不報錯、有輸出、而型別看得見地錯了。
 */
describe('鍵的型別', () => {
  it('🔴 整數鍵印出來沒有引號', async () => {
    expect(await runPython('print({1: "a", 2: "b"})\n')).toContain('{1: \'a\', 2: \'b\'}')
  })

  it('★ 對照組：字串鍵仍然有引號', async () => {
    expect(await runPython('print({"a": 1})\n')).toContain("{'a': 1}")
  })

  it('🔴 推導式建出來的也一樣', async () => {
    expect(await runPython('print({n: n * n for n in [1, 2, 3]})\n')).toContain('{1: 1, 2: 4, 3: 9}')
  })

  it('🔴 `keys()` 與 `items()` 拿到的是原本的型別', async () => {
    const out = await runPython('d = {1: "a"}\nprint(list(d.keys()))\nprint(list(d.items()))\n')
    expect(out).toContain('[1]')
    expect(out).toContain("[(1, 'a')]")
  })

  it('🔴 用指派新增的鍵也要記住型別', async () => {
    expect(await runPython('d = {}\nd[3] = "c"\nprint(d)\n')).toContain("{3: 'c'}")
  })

  it('★ 而查詢仍然查得到（鍵的字串化沒有改）', async () => {
    expect(await runPython('d = {1: "a"}\nprint(d[1], 1 in d)\n')).toContain("a True")
  })
})
