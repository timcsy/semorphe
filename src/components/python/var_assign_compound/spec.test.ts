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

  it('lift：左邊是索引存取時【誠實降級】，不認一半', async () => {
    const got = await ids('nums[0] += 1\n')
    expect(got, '左邊是 subscript，樣式刻意認不出來').not.toContain('python:var_assign_compound')
    expect(got, '而它必須看得見——不是安靜地不見').toContain('unresolved')
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
