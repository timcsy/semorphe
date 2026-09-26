/**
 * `core/molecule.ts`——**選一群 → 邊界上有哪些埠**。
 *
 * 🔴 **驗收那條等式在這裡**（vision 的「分子」②b）：
 * **切前跨邊界連線數 ＝ 切後埠數**，而兩邊**各自獨立算一次**
 * ——`crossingEdges` 走樹數，`boundaryOf` 走選區算。
 * 同一段程式碼算兩次的等式恆真，而那與「做到了」長得一樣。
 */
import { describe, it, expect } from 'vitest'
import { boundaryOf, crossingEdges } from '../../../src/core/molecule'
import type { SemanticNode } from '../../../src/core/types'

/** `n('a', { body: [n('b'), n('c')] })` */
function n(id: string, slots: Record<string, SemanticNode[]> = {}): SemanticNode {
  return { id, componentId: `t:${id}`, properties: {}, slots }
}

//  root
//   └ body: [s1, loop, s4]
//              loop.body: [s2, s3]
const tree = n('root', { body: [n('s1'), n('loop', { body: [n('s2'), n('s3')] }), n('s4')] })

describe('boundaryOf', () => {
  it('一顆節點連它的整個子樹：入口 1，沒有出口', () => {
    const r = boundaryOf(tree, ['loop', 's2', 's3'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.boundary.entry).toEqual({ parent: 'root', slot: 'body', from: 1, to: 1 })
    expect(r.boundary.ports).toEqual([{ side: 'in', node: 'loop', slot: 'body', index: 1 }])
  })

  it('🔴 選父而不選子：那個子節點【就是】一個出向的埠', () => {
    const r = boundaryOf(tree, ['loop', 's2'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.boundary.ports.filter((p) => p.side === 'out')).toEqual([
      { side: 'out', node: 'loop', slot: 'body', index: 1, outside: 's3' },
    ])
  })

  it('一段連續的兄弟：入口的 from–to 蓋住那一段', () => {
    const r = boundaryOf(tree, ['s1', 'loop', 's2', 's3'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.boundary.entry).toEqual({ parent: 'root', slot: 'body', from: 0, to: 1 })
  })

  it('⚠️ 拒絕：中間跳過一句', () => {
    expect(boundaryOf(tree, ['s1', 's4'])).toEqual({ ok: false, reason: 'not-contiguous' })
  })

  it('⚠️ 拒絕：散在兩個不同的位置', () => {
    expect(boundaryOf(tree, ['s1', 's2'])).toEqual({ ok: false, reason: 'not-one-region' })
  })

  it('⚠️ 拒絕：空的 · 含根 · 不存在的 id', () => {
    expect(boundaryOf(tree, [])).toEqual({ ok: false, reason: 'empty' })
    expect(boundaryOf(tree, ['root'])).toEqual({ ok: false, reason: 'includes-root' })
    expect(boundaryOf(tree, ['nope'])).toEqual({ ok: false, reason: 'unknown-node' })
  })
})

describe('🔴 ②b 的硬性零：切前跨邊界連線數 ＝ 切後埠數', () => {
  for (const sel of [['loop', 's2', 's3'], ['loop', 's2'], ['s1', 'loop', 's2', 's3'], ['s4'], ['s2']]) {
    it(`{${sel.join(',')}}`, () => {
      const r = boundaryOf(tree, sel)
      expect(r.ok, `這一組該被接受：${sel}`).toBe(true)
      if (!r.ok) return
      expect(r.boundary.ports.length, '🔴 一條被切斷的邊沒有變成埠').toBe(crossingEdges(tree, sel))
    })
  }

  it('★ 入口條件：那個數字不是恆為 0', () => {
    expect(crossingEdges(tree, ['loop', 's2'])).toBeGreaterThan(1)
  })
})
