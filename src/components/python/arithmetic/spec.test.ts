/**
 * `python:arithmetic` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

describe('python:arithmetic', () => {
  it('★ lift：認得出來，而且【不是】C++ 那顆', async () => {
    const ids = componentIdsOf(await liftPython('1 + 2'))
    expect(ids, '沒認出算術 → 下面會空過').toContain('python:arithmetic')
    expect(ids).not.toContain('cpp:arithmetic')
  })

  it('🔴 接點 left／right 都要在原地', async () => {
    const t = await liftPython('1 + 2')
    const find = (n: SemanticNode | null): SemanticNode | undefined =>
      !n ? undefined : n.componentId === 'python:arithmetic' ? n
        : Object.values(n.children ?? {}).flat().map((k) => find(k)).find(Boolean)
    const a = find(await liftPython('1 + 2'))
    expect(a, '★ 錨點：先要找得到那顆節點').toBeTruthy()
    expect(a!.children.left?.length, 'left 接點空了').toBe(1)
    expect(a!.children.right?.length, 'right 接點空了').toBe(1)
    void t
  })

  it('★ generate：七個運算子都產得回去', async () => {
    for (const src of ['1 + 2', '5 - 3', '2 * 3', '7 / 2', '7 // 2', '7 % 3', '2 ** 8']) {
      expect(gen(await liftPython(src)), src).toBe(src)
    }
  })

  it('🔴 括號：優先級低的子運算式要包起來', async () => {
    expect(gen(await liftPython('(1 + 2) * 3'))).toBe('(1 + 2) * 3')
    expect(gen(await liftPython('1 + 2 * 3')), '這個不需要括號').toBe('1 + 2 * 3')
  })

  it('🟢 `&`／`|`／`^` 收了（2026-08-23）——集合的三個運算，而在整數上是位元', async () => {
    // ⚠️ 這條原本釘的是「位元運算刻意沒收」，而集合進來之後 `a & b` 有了**語義**
    //    ——**邊界移動時要改成釘新的邊界，不是刪掉它**。
    expect(componentIdsOf(await liftPython('c = a & b\n'))).toContain('python:arithmetic')
    expect(await runPython('print({1, 2} & {2, 3}, 5 & 3)\n')).toContain('{2} 1')
  })

  it('⚠️ 而位元反相 `~` 仍然沒收 → 要走【誠實降級】', async () => {
    const ids = componentIdsOf(await liftPython('c = ~a\n'))
    expect(ids, '整段真的抬升到東西了').toContain('python:var_assign')  // ← 正向錨點
    expect(ids, '`~` 沒有路由，不該變成 python:arithmetic').not.toContain('python:arithmetic')
  })
})
