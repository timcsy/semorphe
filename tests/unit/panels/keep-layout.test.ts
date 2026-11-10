import { describe, it, expect } from 'vitest'
import { keepLayoutByIdentity } from '../../../src/panels/blocks/keep-layout'

/** 三句串成一條：a → b → c */
const chain = () => ({
  blocks: { languageVersion: 0, blocks: [{ id: 'A', x: 30, y: 30, next: { block: { id: 'B', next: { block: { id: 'C' } } } } }] },
  blockMappings: [{ blockId: 'A', nodeId: 'a' }, { blockId: 'B', nodeId: 'b' }, { blockId: 'C', nodeId: 'c' }],
})
const roots = (r: object | null) => (r as { blocks: { blocks: { id: string; x: number; y: number; next?: { block?: { id: string } } }[] } }).blocks.blocks
const run = (heads: { nodeId: string; x: number; y: number }[]) => { const s = chain(); return keepLayoutByIdentity(s, s.blockMappings, heads) }

describe('改程式碼之後用節點身分放回手排的位置', () => {
  it('拖開的那一疊：在它開頭斷開、放回原位', () => {
    const r = roots(run([{ nodeId: 'a', x: 50, y: 40 }, { nodeId: 'c', x: 400, y: 300 }]))
    expect(r.map((b) => [b.id, b.x, b.y])).toEqual([['A', 50, 40], ['C', 400, 300]])
    expect(r[0].next?.block?.id, '同一疊的留著').toBe('B')
  })
  it('沒拖過（一疊、在預設位置）⟹ 不動', () => expect(run([{ nodeId: 'a', x: 30, y: 30 }])).toBeNull())
  it('沒有舊位置 ⟹ 不動', () => expect(run([])).toBeNull())
  it('開頭換了（上面多了一行）：跟著原本最上面那一疊的位置', () => {
    expect(roots(run([{ nodeId: 'zz', x: 200, y: 100 }])).map((b) => [b.id, b.x, b.y])).toEqual([['A', 200, 100]])
  })
  it('🔴 放回去的先後與程式碼不同（程式碼裡把 c 移到前面）⟹ 不套用——否則下一次動積木會默默改掉程式順序', () => {
    expect(run([{ nodeId: 'a', x: 30, y: 500 }, { nodeId: 'c', x: 30, y: 100 }])).toBeNull()
  })
  it('不改傳進來的物件', () => {
    const s = chain(); const before = JSON.stringify(s)
    keepLayoutByIdentity(s, s.blockMappings, [{ nodeId: 'a', x: 50, y: 40 }, { nodeId: 'c', x: 400, y: 300 }])
    expect(JSON.stringify(s)).toBe(before)
  })
  it('孤兒積木原樣留著', () => {
    const s = chain(); (s.blocks.blocks as object[]).push({ id: 'O', x: 30, y: 4030 })
    const r = roots(keepLayoutByIdentity(s, s.blockMappings, [{ nodeId: 'a', x: 50, y: 40 }]))
    expect(r.map((b) => b.id)).toEqual(['A', 'O'])
  })
})
