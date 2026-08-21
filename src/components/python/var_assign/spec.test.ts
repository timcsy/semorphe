/** `python:var_assign` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { runPython, liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:var_assign', () => {
  it('★ lift：`x = 5` 認得出來', async () => {
    const ids = componentIdsOf(await liftPython('x = 5\n'))
    expect(ids, '沒認出指派 → 下面會空過').toContain('python:var_assign')
    expect(ids, '⚠️ 名字被當成變數參照了 → 左邊該用 text 不是 lift').not.toContain('python:var_ref')
  })

  it('★ generate ＋ round-trip：沒有型別也沒有分號', async () => {
    expect(gen(await liftPython('x = 5\n'))).toBe('x = 5')
    expect(gen(await liftPython('total = a + b * 2\n'))).toBe('total = a + b * 2')
  })

  it('🔴 有了它，運算式才碰得到——貼上的每一行都是指派', async () => {
    const ids = componentIdsOf(await liftPython('y = x + 3 * 2\n'))
    expect(ids).toContain('python:arithmetic')
    expect(ids).toContain('python:var_ref')
    expect(ids.filter((i) => i === 'unresolved'), '整句降級了').toEqual([])
  })
})

/**
 * 🔴 **參照直譯器抓到的三筆**（2026-08-21～22）——全部不報錯。
 */
describe('指派的三條真規則', () => {
  it('🔴 `n[1] = 7` 要寫進那一格', async () => {
    // 不接的話會建立一個名字叫 `n[1]` 的區域變數，而 `print(n)` 讀原本那個串列
    expect(await runPython('n = [3, 1, 4]\nn[1] = 7\nprint(n)\n')).toContain('[3, 7, 4]')
  })

  it('🔴 字典可以用指派【新增鍵】，而串列不行', async () => {
    expect(await runPython('d = {"a": 1}\nd["b"] = 2\nprint(d)\n')).toContain("{'a': 1, 'b': 2}")
    const grow = await runPython('n = [1]\nn[5] = 9\nprint(n)\n')
    expect(grow, '串列用指派新增一格在 Python 是 IndexError').toMatch(/例外|錯誤|Error/)
  })

  it('🔴 函式裡的指派建立【本地】變數，即使外面有同名的', async () => {
    const out = await runPython('x = 10\ndef f():\n    x = 20\n    return x\n\nprint(f(), x)\n')
    expect(out, `外面的 x 被改掉了：${JSON.stringify(out)}`).toContain('20 10')
  })

  it('★ 對照組：傳進去的容器仍然是同一個（Python 是傳參照）', async () => {
    expect(await runPython('def g(xs):\n    xs.append(1)\n\nys = []\ng(ys)\nprint(len(ys))\n')).toContain('1')
  })
})
