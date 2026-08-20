/**
 * `python:compare` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
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

  it('⚠️ `in`／`is` 刻意沒收 → 不得被認成比較', async () => {
    expect(componentIdsOf(await liftPython('a is b'))).not.toContain('python:compare')
  })
})
