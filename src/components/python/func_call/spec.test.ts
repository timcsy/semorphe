/** `python:func_call` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:func_call', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('add(1, 2)\n'))
    expect(ids, '沒認出呼叫 → 下面會空過').toContain('python:func_call')
  })

  it('🔴 print／input 要先被認走——它們有自己的元件', async () => {
    expect(componentIdsOf(await liftPython('print("hi")\n')),
      '⚠️ 被兜底的呼叫接走了 → 優先級不對').not.toContain('python:func_call')
    expect(componentIdsOf(await liftPython('x = input()\n')))
      .not.toContain('python:func_call')
  })

  it('★ generate ＋ round-trip：語句與運算式兩個位置', async () => {
    expect(gen(await liftPython('add(1, 2)\n'))).toBe('add(1, 2)')
    expect(gen(await liftPython('x = add(1, 2)\n'))).toBe('x = add(1, 2)')
  })

  it('★ 零引數也走得完', async () => {
    expect(gen(await liftPython('reset()\n'))).toBe('reset()')
  })
})

/**
 * 🔴 **內建函式與方法**（2026-08-21）。
 *
 * 起因：執行那一軸量到 15 段語料有 12 段跑不動，其中 **6 段**是這裡
 * ——那 6 段的 lift 與來回轉換**完全正確**，只是跑不動。
 *
 * > **「畫得出來」與「做得到」是兩件事，而只量投影的護欄分不出來。**
 */
describe('內建函式與方法', () => {
  it('自由函式：長度、轉換、極值、加總', async () => {
    expect(await runPython('print(len([1,2,3]))\n')).toContain('3')
    expect(await runPython('print(len("abc"))\n')).toContain('3')
    expect(await runPython('print(str(3) + "!")\n')).toContain('3!')
    expect(await runPython('print(int("42") + 1)\n')).toContain('43')
    expect(await runPython('print(max([5,2,8]))\n')).toContain('8')
    expect(await runPython('print(sum([1,2,3]))\n')).toContain('6')
    expect(await runPython('print(abs(-3))\n')).toContain('3')
    expect(await runPython('print(sorted([3,1,2]))\n')).toContain('[1, 2, 3]')
  })

  it('🔴 方法會【改動】接收者——串列是可變的', async () => {
    expect(await runPython('a = [1]\na.append(2)\nprint(a)\n'), 'append 沒改到原本那個串列').toContain('[1, 2]')
    expect(await runPython('a = [3,1]\na.sort()\nprint(a)\n')).toContain('[1, 3]')
  })

  it('文字的方法', async () => {
    expect(await runPython('s = "Hi There"\nprint(s.upper())\n')).toContain('HI THERE')
    expect(await runPython('s = "a,b"\nprint(s.split(","))\n')).toContain("['a', 'b']")
    expect(await runPython('s = "abc"\nprint(s.replace("b", "X"))\n')).toContain('aXc')
  })

  it('字典的方法', async () => {
    expect(await runPython('d = {"a": 1}\nprint(d.keys())\n')).toContain("['a']")
    expect(await runPython('d = {"a": 1}\nprint(d.get("z", 0))\n')).toContain('0')
  })

  it('🔴 使用者定義的函式優先於內建的——Python 允許蓋掉', async () => {
    const out = await runPython('def len(x):\n    return 99\nprint(len([1,2,3]))\n')
    expect(out, '內建的贏了 → 使用者的定義被忽略').toContain('99')
  })

  it('🔴 認不得的名字要出聲，不得靜默回 None', async () => {
    const out = await runPython('print(no_such_thing(1))\n')
    expect(out).toMatch(/例外|錯誤|Error/)
  })

  it('印出來的樣子照 Python 的規則（True／None／串列）', async () => {
    expect(await runPython('print(str(True))\n')).toContain('True')
    expect(await runPython('print([1, 2])\n')).toContain('[1, 2]')
  })
})
