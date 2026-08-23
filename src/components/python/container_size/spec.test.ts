/**
 * 七顆內建積木的自證測。
 *
 * 🔴 **它們的存在理由是「學生拖得到」**，不是「跑得動」——
 * 那七個名字在這之前就跑得動（走內建表），只是掉進通用的呼叫積木裡，
 * 而學生在工具箱裡找不到「長度」這顆。
 *
 * > **「跑得動」與「拿得到」是兩件事，而只量執行的護欄分不出來。**
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

const CASES: [string, string][] = [
  ['python:container_size', 'a = len(xs)'],
  ['python:math_abs', 'a = abs(-3)'],
  ['python:math_max', 'a = max(xs)'],
  ['python:math_min', 'a = min(1, 2)'],
  ['python:container_sum', 'a = sum(xs)'],
  ['python:container_sort', 'a = sorted(xs)'],
  ['python:range_make', 'a = range(3)'],
]

describe('python 內建的七顆積木', () => {
  it('lift：每一顆都認得出自己那個名字', async () => {
    for (const [id, code] of CASES) {
      expect(await ids(code + '\n'), code).toContain(id)
    }
  })

  it('🔴 lift：別的名字不得被搶走（對照組）', async () => {
    const got = await ids('a = my_len(xs)\n')
    expect(got).toContain('python:func_call')
    expect(got).not.toContain('python:container_size')
  })

  it('來回：一字不差', async () => {
    for (const [, code] of CASES) expect(await rt(code + '\n'), code).toBe(code)
    expect(await rt('a = range(1, 10, 2)\n')).toBe('a = range(1, 10, 2)')
  })

  it('執行：走的是內建表那一份，不是自己算一遍', async () => {
    expect(await runPython('print(len([1,2,3]))\n')).toContain('3')
    expect(await runPython('print(abs(-3))\n')).toContain('3')
    expect(await runPython('print(max([5,2,8]))\n')).toContain('8')
    expect(await runPython('print(min(4, 1))\n')).toContain('1')
    expect(await runPython('print(sum([1,2,3]))\n')).toContain('6')
    expect(await runPython('print(sorted([3,1,2]))\n')).toContain('[1, 2, 3]')
    expect(await runPython('for i in range(3):\n    print(i)\n')).toContain('0\n1\n2')
  })

  it('🔴 已知的邊界：使用者自己 def 同名的函式時，這幾顆仍然會認走它', async () => {
    // 判別在 lift 期，而「有沒有被使用者蓋掉」是執行期才知道的事。
    // 這一支釘住**我們今天的行為**，不是宣稱它是對的。
    expect(await ids('def len(x):\n    return 9\n\na = len(xs)\n')).toContain('python:container_size')
  })
})

/** 四顆方法積木——與上面七顆同一個理由：**學生拖得到**。 */
describe('python 方法的四顆積木', () => {
  const M: [string, string][] = [
    ['python:container_append', 'nums.append(9)'],
    ['python:string_upper', 'a = s.upper()'],
    ['python:string_lower', 'a = s.lower()'],
    ['python:string_split', 'a = s.split(",")'],
  ]

  it('lift：每一顆都認得出自己那個方法', async () => {
    for (const [id, code] of M) expect(await ids(code + '\n'), code).toContain(id)
  })

  it('🔴 別的方法不得被搶走（對照組）', async () => {
    // ⚠️ 這條測試被邊界推著走過**兩次**：`s.strip()`（2026-08-22 有了元件）、
    //    `s.count(...)`（2026-08-23 有了元件）。
    //    ——**它釘的是邊界，所以邊界移動時要換一個還在界外的例子，不是刪掉它**。
    //    今天在界外的：`.extend`（跑得動，而還沒有專屬積木）。
    const got = await ids('xs.extend([1, 2])\n')
    expect(got, '沒有專屬元件的方法走一般方法呼叫').toContain('python:method_call')
  })

  it('來回：一字不差', async () => {
    for (const [, code] of M) expect(await rt(code + '\n'), code).toBe(code)
  })

  it('🔴 來回：語句形態要自己收縮排與換行', async () => {
    // 少了換行的症狀是下一行黏上去——一段不合法的 Python
    expect(await rt('nums.append(9)\nprint(1)\n')).toBe('nums.append(9)\nprint(1)')
  })

  it('執行：走內建表那一份', async () => {
    expect(await runPython('a = [1]\na.append(2)\nprint(a)\n')).toContain('[1, 2]')
    expect(await runPython('print("hi".upper())\n')).toContain('HI')
    expect(await runPython('print("A,B".split(","))\n')).toContain("['A', 'B']")
  })
})
