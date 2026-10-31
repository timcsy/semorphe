/**
 * **流程面板把一塊收成一個有埠的框**（spec 187）——core 那一半：節點圖的框、共享的收合狀態。
 *
 * 🔴 最重要的兩條：
 * ① 框的對外接點與「切斷的邊」對得上——`crossingEdges` 與 `boundaryOf` **各自算一次**（`molecule.ts` 檔頭）
 * ② 每一個 id 都換掉之後（＝在程式碼裡打一個字）仍收著——`granularity.ts` 檔頭點名的那個缺陷
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { liftPython } from './../helpers/python-lift'
import { buildNodeGraph } from '../../src/core/flow/node-graph'
import { boundaryOf, crossingEdges } from '../../src/core/molecule'
import { GranularityState, connectGranularity } from '../../src/core/granularity'
import { SemanticBus } from '../../src/core/sync/semantic-bus'
import type { SemanticNode } from '../../src/core/types'

const CODE = `x = 5
while x > 0:
    if x > 3:
        print("big")
    x = x - 1
print(x)
`

function subtree(n: SemanticNode): string[] {
  const out = [n.id]
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) if (k) out.push(...subtree(k))
  return out
}

let tree: SemanticNode
let loop: SemanticNode

beforeAll(async () => {
  const { registerCppSkipDeclarations } = await import('../../src/languages/cpp/generators/index')
  registerCppSkipDeclarations()
  tree = (await liftPython(CODE))!
  loop = tree.slots['body'].find((n) => n.componentId === 'python:loop_while')!
  expect(loop, '入口條件：要有一顆 while').toBeTruthy()
})

describe('節點圖的框', () => {
  it('不給 collapsed ＝ 今天的圖，逐字相同', () => {
    const body = tree.slots['body']
    expect(buildNodeGraph(body, undefined, { collapsed: new Set() })).toEqual(buildNodeGraph(body))
  })

  it('收起 while：子樹的節點不出現，框寫著裡面有幾塊、只留對外接點', () => {
    const body = tree.slots['body']
    const open = buildNodeGraph(body)
    const g = buildNodeGraph(body, undefined, { collapsed: new Set([loop.id]) })
    const inside = subtree(loop).slice(1)
    expect(inside.length).toBeGreaterThan(3)
    for (const id of inside) expect(g.nodes.some((n) => n.id === id), `框裡的 ${id} 不該畫`).toBe(false)
    expect(g.nodes.length).toBe(open.nodes.length - inside.length)
    const box = g.nodes.find((n) => n.id === loop.id)!
    expect(box.collapsed).toBe(inside.length)
    expect(box.ports.map((p) => p.key)).toEqual(['__in__', '__next__'])
    // 線：框前後的串接還在、沒有一條線指向框裡面
    expect(g.wires.some((w) => w.to.node === loop.id && w.to.port === '__in__')).toBe(true)
    expect(g.wires.some((w) => w.from.node === loop.id && w.from.port === '__next__')).toBe(true)
    for (const w of g.wires) {
      expect(inside.includes(w.from.node) || inside.includes(w.to.node)).toBe(false)
    }
  })

  it('★ 邊界：收起一整個子樹，boundaryOf 只有一個 in、零個 out，而它等於獨立算的 crossingEdges', () => {
    const sel = subtree(loop)
    const b = boundaryOf(tree, sel)
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(b.boundary.ports.filter((p) => p.side === 'in')).toHaveLength(1)
    expect(b.boundary.ports.filter((p) => p.side === 'out')).toHaveLength(0)
    expect(b.boundary.ports.length).toBe(crossingEdges(tree, sel))
  })
})

describe('共享的收合狀態', () => {
  it('收合 → 每一個 id 都換掉（重新 lift 同一段）→ 仍配得回去', async () => {
    const s = new GranularityState()
    s.refresh(tree)
    expect(s.set(loop.id, true)).toBe(true)
    const again = (await liftPython(CODE))!
    const loop2 = again.slots['body'].find((n) => n.componentId === 'python:loop_while')!
    expect(loop2.id, '入口條件：id 真的換了').not.toBe(loop.id)
    expect([...s.refresh(again)]).toEqual([loop2.id])
  })

  it('改一個不相干的值之後仍收著；刪掉那一段之後掉掉', async () => {
    const s = new GranularityState()
    s.refresh(tree)
    s.set(loop.id, true)
    const edited = (await liftPython(CODE.replace('x = 5', 'x = 6')))!
    expect(s.refresh(edited).size).toBe(1)
    const gone = (await liftPython('x = 6\nprint(x)\n'))!
    expect(s.refresh(gone).size, '那一段不在了——安靜地掉').toBe(0)
  })

  it('收起來的那一段裡面被改了（子樹鍵對不到）→ 退回路徑，仍收著同一顆', async () => {
    const s = new GranularityState()
    s.refresh(tree)
    s.set(loop.id, true)
    const edited = (await liftPython(CODE.replace('x = x - 1', 'x = x - 2')))!
    const loop2 = edited.slots['body'].find((n) => n.componentId === 'python:loop_while')!
    expect([...s.refresh(edited)]).toEqual([loop2.id])
  })

  it('展開；不是這棵樹的 id 什麼都不變', () => {
    const s = new GranularityState()
    s.refresh(tree)
    s.set(loop.id, true)
    expect(s.set('nope', true)).toBe(false)
    expect(s.set(loop.id, false)).toBe(true)
    expect(s.list()).toEqual([])
  })

  it('匯流排：請求 → 廣播鑰匙；之後每一次語義更新都再廣播一次（鑰匙換成新樹的）', () => {
    const bus = new SemanticBus()
    connectGranularity(bus)
    const got: number[] = []
    bus.on('granularity:collapsed', (d) => got.push(d.entries.length))
    bus.emit('semantic:update', { tree } as never)
    expect(got, '沒有收著的東西時不吵').toEqual([])
    bus.emit('granularity:request', { nodeId: loop.id, collapsed: true })
    bus.emit('semantic:update', { tree } as never)
    expect(got).toEqual([1, 1])
  })
})
