/**
 * `core/granularity.ts`——**哪幾顆現在是收起來的**。
 *
 * 🔴 **最重要的一條在最後**：`nodeId` 換一輪之後，收合還在嗎。
 * 那是 `layout-key.ts` 的檔頭量到的那個缺陷（2026-08-27）：
 * 「使用者手拖十顆節點，在程式碼裡打一個字，十顆全部跳回自動排版的位置」
 * ——這一支守著它不要在收合上發生第二次。
 */
import { describe, it, expect } from 'vitest'
import {
  resolveCollapsed, collapsedToKeys, outermostCollapsed, hiddenBy, pruneCollapsed, visibilityOf,
} from '../../../src/core/granularity'
import type { SemanticNode } from '../../../src/core/types'

let seq = 0
function n(cid: string, slots: Record<string, SemanticNode[]> = {}): SemanticNode {
  return { id: `id${++seq}`, componentId: cid, properties: {}, slots }
}
/** root ▸ body:[ s1, outer ▸ body:[ inner ▸ body:[ deep ] ] ] */
function build() {
  seq = 0
  const deep = n('t:deep')
  const inner = n('t:inner', { body: [deep] })
  const outer = n('t:outer', { body: [inner] })
  const s1 = n('t:s1')
  return { root: n('t:program', { body: [s1, outer] }), s1, outer, inner, deep }
}

describe('收起來的那幾顆', () => {
  it('最外層：裡面那顆不重複報，而它【不被丟掉】', () => {
    const t = build()
    const c = new Set([t.outer.id, t.inner.id])
    expect(outermostCollapsed(t.root, c)).toEqual([t.outer.id])
    // ⚠️ 展開外層之後裡層該還是收著的 —— 所以集合裡兩顆都還在
    expect(outermostCollapsed(t.root, new Set([t.inner.id]))).toEqual([t.inner.id])
  })

  it('被藏起來的不含它自己——收起來的那顆還看得到，只是變一行', () => {
    const t = build()
    const h = hiddenBy(t.root, new Set([t.outer.id]))
    expect(h.has(t.outer.id), '🔴 收起來的那顆不該算被藏起來').toBe(false)
    expect([...h].sort()).toEqual([t.inner.id, t.deep.id].sort())
  })

  it('三種可見性', () => {
    const t = build()
    const v = visibilityOf(t.root, new Set([t.outer.id]))
    expect(v.get(t.s1.id)).toBe('normal')
    expect(v.get(t.outer.id)).toBe('collapsed')
    expect(v.get(t.deep.id)).toBe('hidden')
  })

  it('清場：不在這棵樹裡的掉掉', () => {
    const t = build()
    expect(pruneCollapsed(t.root, new Set([t.outer.id, 'gone']))).toEqual(new Set([t.outer.id]))
  })
})

describe('🔴 nodeId 全換一輪之後，收合還在嗎', () => {
  it('存檔 → 換一棵【同形但 id 全不同】的樹 → 配得回去', () => {
    const a = build()
    const saved = collapsedToKeys(a.root, new Set([a.outer.id]))
    expect(saved.length, '🔴 存不出鑰匙').toBe(1)

    const b = build() // 同一個形狀，而 seq 重置 ⟹ 這裡刻意讓 id 一樣的問題現形
    // 強制把 b 的每一個 id 都換掉，模擬「重新 lift」
    const rename = (x: SemanticNode): void => {
      x.id = `RE_${x.id}`
      for (const kids of Object.values(x.slots ?? {})) for (const k of kids ?? []) if (k) rename(k)
    }
    rename(b.root)
    expect(b.outer.id.startsWith('RE_'), 'id 真的被換了').toBe(true)

    const back = resolveCollapsed(saved, b.root)
    expect(back, '🔴 打一個字就全部展開 —— 那是 layout-key 檔頭記著的那個缺陷').toEqual(new Set([b.outer.id]))
  })

  it('★ 入口條件：這一條不是恆真——刪掉那一段之後就配不回去', () => {
    const a = build()
    const saved = collapsedToKeys(a.root, new Set([a.outer.id]))
    const empty: SemanticNode = { id: 'x', componentId: 't:program', properties: {}, slots: { body: [] } }
    expect(resolveCollapsed(saved, empty).size, '🔴 配不到就該掉，不該亂配').toBe(0)
  })
})
