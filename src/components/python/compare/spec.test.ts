/**
 * `python:compare` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { runPython, liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:compare', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('a < b'))
    expect(ids, '沒認出比較 → 下面會空過').toContain('python:compare')
    expect(ids).not.toContain('cpp:compare')
  })

  it('🔴 位置式子節點：left／right 都要接到（這顆的取法與同族不同）', async () => {
    const find = (n: SemanticNode | null): SemanticNode | undefined =>
      !n ? undefined : n.componentId === 'python:compare' ? n
        : Object.values(n.children ?? {}).flat().map((k) => find(k)).find(Boolean)
    const c = find(await liftPython('a < b'))
    expect(c, '★ 錨點：先要找得到').toBeTruthy()
    expect(c!.children.left?.length, '🔴 `comparison_operator` 沒有 left 欄位——用的是 $namedChildren[0]').toBe(1)
    expect(c!.children.right?.length, '同上，$namedChildren[1]').toBe(1)
  })

  it('★ generate ＋ round-trip：六個運算子', async () => {
    for (const src of ['a < b', 'a > b', 'a <= b', 'a >= b', 'a == b', 'a != b']) {
      expect(gen(await liftPython(src)), src).toBe(src)
    }
  })

  /**
   * 🔴 **這一支原本釘的是舊邊界**：「`in`／`is` 刻意沒收」。
   * 兩個都在 2026-08-21～22 收了，而**各自去了不同的地方**：
   *
   * ```
   * in / not in   →  同族的「在不在裡面」那顆（它問的是容器）
   * is / is not   →  這一顆（它問的是相等）
   * ```
   *
   * > **一條「還沒支援」的測試，在支援的那天要改成「支援到哪裡」。**
   */
  it('🔴 `is` 走這一顆，而 `in` 走同族那顆——兩者不得互搶', async () => {
    expect(componentIdsOf(await liftPython('a = b is None\n'))).toContain('python:compare')
    const inIds = componentIdsOf(await liftPython('a = "k" in d\n'))
    expect(inIds, '`in` 問的是容器，不是相等').not.toContain('python:compare')
    expect(inIds).toContain('python:container_find')
  })

  it('🔴 等不等要先看型別——不得先轉成數字', async () => {
    // `"" == None` 兩邊轉成數字都是 0 → 相等。真 Python 是 False。
    expect(await runPython('print("" == None)\n')).toContain('False')
    expect(await runPython('print(0 == False)\n'), '而數字家族互相比得動').toContain('True')
    expect(await runPython('print([1,2] == [1,2])\n'), '容器逐格比').toContain('True')
  })
})

/**
 * 🔴 **序對逐格比**（2026-08-22）。`sorted(key=lambda p: (-p[1], p[0]))`
 * 的鍵是一個 tuple，而比較器曾經只認數字與字串——`toNumber` 對序對給 NaN，
 * 所有比較都變成 false，於是排序**退化成原本的順序**。
 *
 * ⚠️ 症狀看起來像「`key=` 沒生效」，而其實是比較器不認得那種鍵。
 */
describe('序對的大小', () => {
  it('🔴 先比第一格，相同才比第二格', async () => {
    expect(await runPython('print(sorted([(2, "b"), (1, "a"), (2, "a")]))\n'))
      .toContain("[(1, 'a'), (2, 'a'), (2, 'b')]")
  })

  it('🔴 排序的鍵是序對時也要對——這是它被發現的場景', async () => {
    const out = await runPython('text = "banana"\ncount = {}\nfor ch in text:\n    count[ch] = count.get(ch, 0) + 1\nfor ch, n in sorted(count.items(), key=lambda p: (-p[1], p[0])):\n    print(ch, n)\n')
    expect(out).toContain('a 3\nn 2\nb 1')
  })

  it('★ 前面都相同時短的比較小', async () => {
    expect(await runPython('print(sorted([(1, 2), (1,)]))\n')).toContain('[(1,), (1, 2)]')
  })
})
