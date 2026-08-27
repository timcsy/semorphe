/**
 * **手拖的佈局記在哪一把鑰匙上**——`core/flow/layout-key.ts`。
 *
 * ## 它從哪來
 *
 * 路線圖把這件事寫成一個開放問句（`vision.md`「**nodeId 穩不穩定**——不穩就對不回去」）。
 * 2026-08-27 量出來的答案比「不穩」更硬：**改一行不相干的程式碼，id 相同數 0**
 * ——連沒有變的 `func_def`／`program` 都換了 id。那是 `generateId()` 的形狀
 * （`node_${++counter}_${Date.now()}`）決定的，不是偶然。
 *
 * 🔴 而它不只是「還沒持久化」：**使用者手拖十顆節點、在程式碼裡打一個字，
 * 十顆全部跳回自動排版的位置。**
 *
 * ## 三把鑰匙一起用，因為它們的失效條件互斥
 *
 * ```
 * 在後面加一行     路徑掉「索引位移的兄弟」   行號掉「行號變了的」   內容【不掉】
 * 改一個值         路徑不掉                 行號不掉             內容掉那一顆
 * ```
 *
 * 量出來：路徑 83%、行號 92%、內容 96%、**三把一起 100%**
 * （`tests/integration/audit-layout-key.test.ts` 的報表）。
 *
 * ## ⚠️ 曖昧的鍵一律不算命中
 *
 * 拿掉父路徑之後內容鍵容易撞（`int x = 1` 與 `int y = 1` 的兩個 `1`）。
 * `matchNodes` 只收「**兩邊都只出現一次**」的鍵。
 *
 * > **寧可對不回去，不要對到別人身上。**
 */
import { describe, it, expect } from 'vitest'
import {
  walkWithPath, keyByPath, keyByContent, matchNodes, type KeyedNode,
} from '../../../src/core/flow/layout-key'
import type { SemanticNode } from '../../../src/core/types'

/** 一棵手寫的樹——⚠️ 刻意**不**用 lifter：這一支測的是配對，不是抬升。 */
const tree = (bodies: { id: string; c: string; v?: string }[]): SemanticNode =>
  ({
    id: 'root', componentId: 'x:program', properties: {},
    children: {
      body: bodies.map((b) => ({
        id: b.id, componentId: b.c,
        properties: b.v === undefined ? {} : { value: b.v },
        children: {},
      })),
    },
  }) as unknown as SemanticNode

const keyed = (t: SemanticNode, lines?: Record<string, number>): KeyedNode[] =>
  walkWithPath(t, (id) => lines?.[id] ?? null)

describe('flow/layout-key', () => {
  it('★ 入口條件：走得出路徑，而路徑真的長那樣', () => {
    const ks = keyed(tree([{ id: 'a', c: 'x:n' }]))
    expect(ks.length, '一顆都沒走到 → 下面在測空的').toBe(2)
    expect(ks.map((k) => k.path)).toEqual(['', '/body[0]'])
    expect(keyByPath(ks[1])).toBe('x:n@/body[0]')
  })

  it('🔴 內容鍵**不含**父路徑——含了就跟路徑鍵一起壞', () => {
    // 第一版把父路徑編進內容鍵，於是 `return 0;` 那顆 `0` 在插一行之後
    // **三把鑰匙全掉**——因為那一行同時改了它的路徑、行號、與內容鍵。
    //
    // > **三把鑰匙的價值在於失效條件互斥。把其中一把的條件抄進另一把，
    // > 就等於少了一把。**
    // ⚠️ **樣本要巢狀**——第一版拿兩顆根的直接子節點來比，
    //    而剝掉索引之後它們的父路徑一樣（都是空字串），
    //    於是「把父路徑加回去」這個注入**通過了**。
    //    真正壞掉的案例是 `/body[0]/body[3]/value[0]` → `/body[0]/body[4]/value[0]`。
    //
    // > **一個測不出差別的樣本，會讓兩個不同的實作看起來一樣。**
    const nested = (n: number): SemanticNode =>
      ({
        id: 'root', componentId: 'x:program', properties: {},
        children: { body: [{
          id: 'f', componentId: 'x:fn', properties: {},
          children: { body: Array.from({ length: n }, (_, i) => ({
            id: `s${i}`, componentId: 'x:pad', properties: {}, children: {},
          })).concat([{
            id: 'ret', componentId: 'x:ret', properties: {},
            children: { value: [{ id: 'lit', componentId: 'x:n', properties: { value: '7' }, children: {} }] },
          } as never]),
          },
        }] },
      }) as unknown as SemanticNode
    const litOf = (t: SemanticNode): KeyedNode =>
      keyed(t).find((k) => k.node.componentId === 'x:n')!
    const a = litOf(nested(1))
    const b = litOf(nested(2))
    expect(keyByPath(a), '前提：路徑真的變了').not.toBe(keyByPath(b))
    expect(keyByContent(a), '🔴 內容鍵跟著路徑變了').toBe(keyByContent(b))
  })

  it('🔴 在前面插一個兄弟 → 後面那些仍然配得上', () => {
    const before = keyed(tree([{ id: 'a', c: 'x:n', v: '1' }, { id: 'b', c: 'x:n', v: '2' }]))
    const after = keyed(tree([
      { id: 'z', c: 'x:n', v: '9' }, { id: 'a2', c: 'x:n', v: '1' }, { id: 'b2', c: 'x:n', v: '2' },
    ]))
    const m = matchNodes(before, after)
    expect(m.get('a'), '🔴 索引位移就對不回去了').toBe('a2')
    expect(m.get('b')).toBe('b2')
  })

  it('🔴 改一個值 → 那一顆靠【路徑】接住', () => {
    const before = keyed(tree([{ id: 'a', c: 'x:n', v: '1' }]))
    const after = keyed(tree([{ id: 'a2', c: 'x:n', v: '99' }]))
    expect(keyByContent(before[1]), '前提：內容鍵真的變了')
      .not.toBe(keyByContent(after[1]))
    expect(matchNodes(before, after).get('a'), '🔴 改個值就掉位置了').toBe('a2')
  })

  it('★ 反向：曖昧的鍵【不算命中】——寧可對不回去，不要對到別人身上', () => {
    // 兩顆一模一樣的節點，而位置也都變了 → 三把鑰匙都撞 → 不配對。
    const before = keyed(tree([{ id: 'a', c: 'x:n', v: '1' }, { id: 'b', c: 'x:n', v: '1' }]))
    const after = keyed(tree([
      { id: 'p', c: 'x:pad' }, { id: 'q', c: 'x:pad' },
      { id: 'a2', c: 'x:n', v: '1' }, { id: 'b2', c: 'x:n', v: '1' },
    ]))
    const m = matchNodes(before, after)
    expect(m.get('a'), '🔴 撞了還硬配 → 佈局會跑到別人身上').toBeUndefined()
    expect(m.get('b')).toBeUndefined()
  })

  it('★ 反向：一顆新節點【不會】搶走別人的配對', () => {
    const before = keyed(tree([{ id: 'a', c: 'x:n', v: '1' }]))
    const after = keyed(tree([{ id: 'a2', c: 'x:n', v: '1' }, { id: 'new', c: 'x:n', v: '2' }]))
    const m = matchNodes(before, after)
    expect(m.size, '只該配到一顆').toBe(2)   // root ＋ a
    expect(m.get('a')).toBe('a2')
  })
})
