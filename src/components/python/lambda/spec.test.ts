/**
 * 匿名函式、關鍵字引數、字典生成式、`set()`、另外兩種格式化。
 *
 * 🔴 **這一批裡最危險的一個缺陷不報錯**：`xs.sort(key=lambda x: x[1])`
 * 在接上 `key=` 之前**排序仍然發生、仍然有輸出，而順序是錯的**
 * ——語料的三軸全綠而答案是假的。
 *
 * > **一個被忽略的參數不會讓程式停下來，它只會讓答案不一樣。**
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

describe('python:lambda 與關鍵字引數', () => {
  it('lift：兩顆都認得出來', async () => {
    expect(await ids('f = lambda x: x + 1\n')).toContain('python:lambda')
    // ⚠️ 2026-08-23：這裡原本用 `xs.sort(key=f)`，而就地排序那天有了自己的元件
    //    （關鍵字進了它的具名接點）——**換一個還會走「具名引數」那顆的例子**。
    expect(await ids('g(key=f)\n')).toContain('python:func_call_named')
  })

  it('🔴 lift：帶預設值的參數整顆降級——收一半會讓使用者的東西不見', async () => {
    expect(await ids('f = lambda x=1: x\n')).not.toContain('python:lambda')
  })

  it('來回：一字不差', async () => {
    for (const c of ['f = lambda x: x + 1', 'f = lambda: 1', 'f = lambda a, b: a + b', 'xs.sort(key=f)']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('🔴 執行：排序真的照 key —— 這一條在修之前是【安靜地錯】', async () => {
    const out = await runPython('p = [("甲", 12), ("乙", 10)]\np.sort(key=lambda x: x[1])\nprint(p[0][0])\n')
    expect(out, `照 key 排的話第一個該是「乙」（10 < 12）：${JSON.stringify(out)}`).toContain('乙')
  })

  it('執行：沒有 key 時照值排（對照組）', async () => {
    expect(await runPython('print(sorted([3, 1, 2]))\n')).toContain('[1, 2, 3]')
  })
})

describe('python:map_make_for（字典生成式）', () => {
  it('lift：認得出來且不降級', async () => {
    const got = await ids('d = {k: v for k, v in s.items()}\n')
    expect(got).toContain('python:map_make_for')
    expect(got).not.toContain('unresolved')
  })

  it('來回：有無篩選都一字不差', async () => {
    for (const c of ['d = {k: v for k, v in s.items()}', 'd = {k: v for k, v in s.items() if v > 1}']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('執行：篩選有作用', async () => {
    const out = await runPython('s = {"a": 90, "b": 70}\nprint({k: v for k, v in s.items() if v >= 80})\n')
    expect(out).toContain("{'a': 90}")
  })

  it('🔴 執行：那些名字不得污染外面', async () => {
    expect(await runPython('k = 99\ns = {"a": 1}\nd = {k: v for k, v in s.items()}\nprint(k)\n')).toContain('99')
  })
})

describe('另外兩種格式化與 set()', () => {
  it('執行：`.format()` 與 `%`', async () => {
    expect(await runPython('print("你好，{}".format("小明"))\n')).toContain('你好，小明')
    expect(await runPython('print("%s 你好" % "小華")\n')).toContain('小華 你好')
  })

  it('🔴 執行：`"a" % b` 是格式化不是取餘數', async () => {
    // 不分辨的症狀是「文字不能做 %」——那句話對取餘數是對的，
    // 而使用者寫的根本不是取餘數
    const out = await runPython('print("%s!" % "hi")\n')
    expect(out).not.toMatch(/例外|錯誤/)
  })

  it('執行：`set()` 去重（已知的簡化：沒有集合型別）', async () => {
    expect(await runPython('print(len(set([1, 2, 2, 3])))\n')).toContain('3')
  })
})
