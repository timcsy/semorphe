/**
 * **括號是排版，而排版是使用者寫的。**
 *
 * ## 為什麼有這一支（使用者 2026-08-22 截圖回報）
 *
 * 一元二次方程式——教學語料裡最基本的那一種——畫出來一半是灰的：
 *
 * ```python
 * x1 = (-b + D)/(2 * a)
 * ```
 * ```
 * 設定 x1 為  ⟨直接寫運算式：(-b + D)⟩  ÷  ⟨直接寫運算式：(2 * a)⟩
 * ```
 *
 * Python 那側**沒有「括號」那一筆 unwrap 樣式**（C++ 有 `cpp_unwrap_parens`），
 * 於是每一個帶括號的子運算式都整段降級。
 *
 * ## 🔴 而只拆不記會改到使用者的碼
 *
 * 產生器只照優先級補回**必要的**括號，於是 `a + (b * c)` 產回 `a + b * c`
 * ——語義一樣，**而那不是使用者寫的東西**。
 *
 * > **一個「拆掉一層」的機制，答不出「拆掉的那一層有沒有意義」——只有宣告答得出。**
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

describe('括號', () => {
  it('★ 錨點：沒有括號的運算式本來就不降級（否則下面在驗空集合）', async () => {
    expect(await ids('y = a + b * c\n')).not.toContain('unresolved')
  })

  it('🔴 帶括號的子運算式不得降級——這是使用者回報的那一段', async () => {
    for (const c of ['x1 = (-b + D)/(2 * a)\n', 'y = (a + b) * c\n', 'q = 2 * (a + 1) - 3\n']) {
      const got = await ids(c)
      expect(got, `${c.trim()} 變灰了`).not.toContain('unresolved')
      expect(got, `${c.trim()} 變灰了`).not.toContain('python:raw_expression')
    }
  })

  it('🔴 **必要的**括號要留著——拿掉會改變答案', async () => {
    expect(await rt('y = (a + b) * c\n')).toBe('y = (a + b) * c')
    expect(await rt('x1 = (-b + D) / (2 * a)\n')).toBe('x1 = (-b + D) / (2 * a)')
  })

  it('🔴 **不必要的**括號也要留著——那是使用者的排版，不是我們的', async () => {
    expect(await rt('z = a + (b * c)\n'), '照優先級補的話這一對會消失').toBe('z = a + (b * c)')
    expect(await rt('w = (a)\n')).toBe('w = (a)')
  })

  /**
   * ⚠️ **已知的邊界，不是漏的**：`layoutHints` 記的是「這裡有沒有括號」（布林），
   * 記不住**有幾層**。所以 `((a + b))` 會塌成 `(a + b)`。
   *
   * 🔴 寫成一條會紅的測試而不是一句註解——**邊界要有人在看**：
   * 哪天它被改成記層數，這一條會紅，而那時該做的是把它改成釘新的邊界。
   */
  it('⚠️ 已知邊界：巢狀的多餘括號會塌成一層', async () => {
    expect(await rt('v = ((a + b))\n'), '記的是有沒有，不是有幾層').toBe('v = (a + b)')
  })

  it('★ 不得多括一層——排版那一對與優先級那一對是同一對', async () => {
    expect(await rt('u = (a + b) * c\n')).not.toContain('((')
  })

  it('🔴 execute：算出來的答案要對', async () => {
    const out = await runPython('a, b, c = 1, 2, 3\nD = b ** 2 - 4 * a * c\nprint((-b + D) / (2 * a), (-b - D) / (2 * a))\n')
    expect(out).toContain('-5.0 3.0')
  })

  it('★ 對照組：`(1, 2)` 是序對不是括號——不得被這一筆拆掉', async () => {
    expect(await ids('p = (3, 4)\n')).toContain('python:tuple_make')
    expect(await rt('p = (3, 4)\n')).toBe('p = (3, 4)')
    expect(await rt('print((1,))\n')).toBe('print((1,))')
  })
})
