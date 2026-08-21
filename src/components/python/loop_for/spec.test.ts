/** `python:loop_for` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:loop_for', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('for i in range(3):\n    print(i)\n'))
    expect(ids, '沒認出 for → 下面會空過').toContain('python:loop_for')
    expect(ids, '⚠️ 撿到 C++ 那顆三格式的 for 了').not.toContain('cpp:loop_for')
  })

  it('🔴 `range(3)` 進的是【可走訪】那個插槽，不是一個次數欄位', async () => {
    const ids = componentIdsOf(await liftPython('for i in range(3):\n    print(i)\n'))
    expect(ids, 'range(...) 該是一顆呼叫積木').toContain('python:func_call')
  })

  it('★ generate ＋ round-trip', async () => {
    expect(gen(await liftPython('for i in range(3):\n    print(i)\n')))
      .toBe('for i in range(3):\n    print(i)')
  })

  it('★ 走訪的不是 range 時也產得回去（它只是一個運算式）', async () => {
    expect(gen(await liftPython('for c in name:\n    print(c)\n')))
      .toBe('for c in name:\n    print(c)')
  })
})

/**
 * 🔴 **走訪的不只是 `range(...)`**（2026-08-21）。
 *
 * 這一支原本只接受 `range`，其餘丟「我看不懂」。在只有數字迴圈的時候那是誠實的；
 * 而串列字面做出來的**同一天**，`for n in nums:` 就成了最自然的寫法
 * ——**使用者在瀏覽器按下執行才看到那句話**，而當時 5068 支測試全綠。
 *
 * > **一顆新元件會讓別處一條「還沒支援」的分支，從誠實變成擋路。**
 */
describe('for 走訪四種來源', () => {
  it('串列：走的是每一格的值', async () => {
    expect(await runPython('nums = [3, 1, 4]\ntotal = 0\nfor n in nums:\n    total += n\nprint(total)\n')).toContain('8')
  })

  it('文字：走的是一個一個字', async () => {
    expect(await runPython('for c in "abc":\n    print(c)\n')).toContain('a\nb\nc')
  })

  it('🔴 字典：走的是【鍵】不是值——做錯會讓學生學到錯的模型', async () => {
    const out = await runPython('d = {"甲": 1, "乙": 2}\nfor k in d:\n    print(k)\n')
    expect(out).toContain('甲')
    expect(out, '印出了值 → 走成了 values').not.toMatch(/^\s*1/m)
  })

  it('range 仍然照舊（對照組）', async () => {
    expect(await runPython('for i in range(3):\n    print(i)\n')).toContain('0\n1\n2')
  })

  it('🔴 走訪不了的東西要出聲，不得靜靜跑零圈', async () => {
    const out = await runPython('for x in 5:\n    print(x)\n')
    expect(out, `靜靜跑完了：${JSON.stringify(out)}——那與「序列是空的」長得一樣`).toMatch(/例外|錯誤|Error/)
  })
})
