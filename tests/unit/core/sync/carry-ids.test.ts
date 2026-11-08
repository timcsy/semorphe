/**
 * 改程式碼之後，沒動到的節點保住身分（spec 221）：對得出唯一對應的沿用，對不上的換新——不猜。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { carryIds } from '../../../../src/core/sync/carry-ids'
import type { SemanticNode } from '../../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const main = (body: string): string => `int main() {\n${body}    return 0;\n}\n`
const all = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, out)
  return out
}
const body = (t: SemanticNode): SemanticNode[] => all(t).find((n) => n.componentId === 'cpp:func_def')!.slots.body
const ids = (t: SemanticNode): Set<string> => new Set(all(t).map((n) => n.id))

const A = '    int n = 5;\n'
const B = '    cout << n << endl;\n'
const C = '    n = n + 1;\n'

describe('carryIds', () => {
  it('完全相同 → 每一個節點都沿用', () => {
    const prev = lift(main(A + B))
    const next = lift(main(A + B))
    carryIds(prev, next)
    expect(all(next).map((n) => n.id)).toEqual(all(prev).map((n) => n.id))
  })
  it('改一個字面值 → 那一句與其他句都沿用（同一個位置、同一種元件）', () => {
    const prev = lift(main(A + B))
    const next = lift(main('    int n = 6;\n' + B))
    carryIds(prev, next)
    expect(body(next).map((n) => n.id)).toEqual(body(prev).map((n) => n.id))
    const lit = (t: SemanticNode) => all(body(t)[0]).find((n) => n.componentId === 'cpp:literal_number')!
    expect(lit(next).id).toBe(lit(prev).id)
    expect(lit(next).properties.value).toBe('6')
  })
  it('中間插入一句 → 前後沒動的都沿用、新的那句是新身分', () => {
    const prev = lift(main(A + B))
    const next = lift(main(A + C + B))
    carryIds(prev, next)
    const [p0, p1, p2] = body(prev)
    const [n0, n1, n2, n3] = body(next)
    expect(n0.id).toBe(p0.id)
    expect(n2.id).toBe(p1.id)
    expect(n3.id).toBe(p2.id)
    expect(ids(prev).has(n1.id)).toBe(false)
  })
  it('刪掉一句 → 其餘沿用', () => {
    const prev = lift(main(A + C + B))
    const next = lift(main(A + B))
    carryIds(prev, next)
    expect(body(next).map((n) => n.id)).toEqual([body(prev)[0].id, body(prev)[2].id, body(prev)[3].id])
  })
  it('兩句一模一樣、刪掉一句 → 剩下的照順序沿用其中一個，不重複', () => {
    const prev = lift(main(A + B + B))
    const next = lift(main(A + B))
    carryIds(prev, next)
    const got = all(next).map((n) => n.id)
    expect(new Set(got).size).toBe(got.length)
    expect(body(next)[1].id).toBe(body(prev)[1].id)
  })
  it('同一段裡有增有刪、數量不同 → 那一段換新，不猜', () => {
    const prev = lift(main(A + '    n = 1;\n    n = 2;\n' + B))
    const next = lift(main(A + '    n = 9;\n' + B))
    carryIds(prev, next)
    expect(body(next)[0].id).toBe(body(prev)[0].id)
    expect(ids(prev).has(body(next)[1].id)).toBe(false)
    expect(body(next)[2].id).toBe(body(prev)[3].id)
  })
  it('元件換了（while → if）→ 不沿用', () => {
    const prev = lift(main(A + '    while (n > 0) {\n        n = n - 1;\n    }\n'))
    const next = lift(main(A + '    if (n > 0) {\n        n = n - 1;\n    }\n'))
    carryIds(prev, next)
    expect(ids(prev).has(body(next)[1].id)).toBe(false)
    // 換了的那顆底下也不沿用（不往下對）
    expect(all(body(next)[1]).some((n) => ids(prev).has(n.id))).toBe(false)
  })
  it('沿用不改動任何形狀（只換身分）', () => {
    const prev = lift(main(A + B))
    const next = lift(main('    int n = 6;\n' + C + B))
    const strip = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(strip)])]
    const before = JSON.stringify(strip(next))
    carryIds(prev, next)
    expect(JSON.stringify(strip(next))).toBe(before)
    const got = all(next).map((n) => n.id)
    expect(new Set(got).size).toBe(got.length)
  })
  it('根的元件不同（換了語言）→ 什麼都不沿用', () => {
    const prev = lift(main(A))
    const next = structuredClone(lift(main(A)))
    next.componentId = 'python:program'
    carryIds(prev, next)
    expect(all(next).some((n) => ids(prev).has(n.id))).toBe(false)
  })
})
