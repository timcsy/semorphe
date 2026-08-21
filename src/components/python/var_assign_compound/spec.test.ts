/**
 * `python:var_assign_compound` 的自證測。
 *
 * 🔴 重點在**運算規則**：Python 的 `/=` 是真除法、`%=` 跟著除數的正負號、
 * 多一個 `//=`——共用的那支複合指派執行器（C++ 在用的）三條都不對。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => generatePython(await liftPython(c)).trim()

describe('python:var_assign_compound', () => {
  it('lift：認得出來，而且不降級', async () => {
    const got = await ids('total += i\n')
    expect(got, '正向錨點——沒有它，下面的負向會空過').toContain('python:var_assign_compound')
    expect(got).not.toContain('unresolved')
  })

  /**
   * 🔴 **邊界推了一格**（2026-08-21）：第一版用 `constraints` 把左邊限定成
   * 單純的變數名，理由是「認一半不如誠實降級」——而**類別做出來之後
   * `self.n += k` 是最常見的一行**，那個限制就從誠實變成擋路。
   *
   * > **一個「還沒支援」的限制，會在別的東西做出來的那天變成擋路的。**
   */
  it('🔴 左邊可以是取成員（`self.n += k`）', async () => {
    const got = await ids('self.n += 1\n')
    expect(got, '正向錨點').toContain('python:var_assign_compound')
    expect(got).not.toContain('unresolved')
  })

  it('🔴 左邊也可以是索引（`nums[0] += 5`）', async () => {
    expect(await ids('nums[0] += 1\n')).toContain('python:var_assign_compound')
    expect(await rt('nums[0] += 1\n')).toBe('nums[0] += 1')
    expect(await runPython('nums = [1, 2]\nnums[0] += 5\nprint(nums)\n')).toContain('[6, 2]')
  })

  it('🔴 而索引取不到時要出聲，不得靜默', async () => {
    const out = await runPython('nums = [1]\nnums[9] += 1\nprint(nums)\n')
    expect(out).toMatch(/例外|錯誤|Error/)
  })

  it('執行：物件的欄位也累加得起來', async () => {
    const out = await runPython('class C:\n    def __init__(self):\n        self.n = 0\n\n    def add(self, k):\n        self.n += k\n\nc = C()\nc.add(3)\nc.add(4)\nprint(c.n)\n')
    expect(out).toContain('7')
  })

  it('來回：六個運算子都一字不差', async () => {
    for (const op of ['+=', '-=', '*=', '/=', '//=', '%=']) {
      expect(await rt(`total ${op} 3\n`)).toBe(`total ${op} 3`)
    }
  })

  it('執行：累加迴圈算得出正確的和', async () => {
    expect(await runPython('total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)\n')).toContain('10')
  })

  it('🔴 執行：Python 的除法規則（三條 C++ 都不同）', async () => {
    expect(await runPython('x = 7\nx /= 2\nprint(x)\n'), '`/=` 是真除法').toContain('3.5')
    expect(await runPython('x = 7\nx //= 2\nprint(x)\n'), '`//=` 捨去小數').toContain('3')
    expect(await runPython('x = -7\nx %= 3\nprint(x)\n'), '餘數跟著除數的正負號').toContain('2')
  })
})
