/**
 * **Python 的 formalize**（spec 195）——先量展開器自己，再拿它量課文（〈一個量測工具，在它自己被量過之前……〉）。
 *
 * 範例來自 Cella 的參考實作（`tools/python/component_map_check.py`，由 `tools/sync-python-formalize.py` 同步成
 * `tests/fixtures/python-component-map.json`）：每個元件實例的「預期樹」是 generate.ts 產生的 Python 經 CPython `ast` 轉出的，
 * 不是照對照表展開的——**兩條獨立的路對得上**才算數。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { expandPython, formalizePython, pyFloatRepr } from '../../../src/providers/cella/formalize/python'
import type { SemanticNode } from '../../../src/core/types'

const FIX = JSON.parse(fs.readFileSync('tests/fixtures/python-component-map.json', 'utf8')) as {
  statementRole: string[]
  cases: { component: string; src: string; statement: boolean; instance: SemanticNode; want: unknown }[]
}

const strip = (x: unknown): unknown => {
  if (Array.isArray(x)) return x.map(strip)
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'n').map(([k, v]) => [k, strip(v)]))
  return x
}

describe('Python 的 formalize：Cella 的範例（generate.ts 產生的 Python 經 CPython ast 轉出）', () => {
  it('★ 入口條件：範例有上百個、涵蓋大多數元件', () => {
    expect(FIX.cases.length).toBeGreaterThan(100)
    expect(new Set(FIX.cases.map((c) => c.component)).size).toBeGreaterThan(80)
  })

  it('🔴 每一個範例照我們的展開器展開，與 CPython ast 轉出的相同（節點 id 除外）', () => {
    const bad: string[] = []
    for (const c of FIX.cases) {
      const r = expandPython(c.instance, c.statement)
      if (!r.program) { bad.push(`${c.component}（${c.src.trim()}）：翻不出——${JSON.stringify(r.unknown)}`); continue }
      const got = c.statement ? (r.program as { body: unknown[] }).body[0] : r.program
      const a = JSON.stringify(strip(got))
      const b = JSON.stringify(c.want)
      if (a !== b) bad.push(`${c.component}（${c.src.trim()}）\n    我們 ${a.slice(0, 300)}\n    預期 ${b.slice(0, 300)}`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('★ 節點 id 的慣例：最外層是元件的 id；空的槽是洞 <id>#<槽名>；敘述位置的運算式包 <id>/stmt', () => {
    const x = { id: 'b1', componentId: 'python:arithmetic', properties: { operator: '+' }, slots: { left: [{ id: 'b2', componentId: 'python:var_ref', properties: { name: 'a' }, slots: {} }] } } as unknown as SemanticNode
    const e = expandPython(x, false).program as Record<string, any>
    expect(e.n).toBe('b1')
    expect(e.right).toEqual({ k: 'eHole', n: 'b1#right' })
    const s = (expandPython(x, true).program as Record<string, any>).body[0]
    expect(s).toMatchObject({ k: 'sExpr', n: 'b1/stmt' })
  })

  it('🔴 翻不了的不猜：原樣保留的程式碼、沒有對應的運算子 → unknown，說出節點與元件', () => {
    const raw = { id: 'r1', componentId: 'python:raw_code', properties: { code: 'x = 1' }, slots: {} } as unknown as SemanticNode
    const r = formalizePython({ id: 'p', componentId: 'python:program', properties: {}, slots: { body: [raw] } } as unknown as SemanticNode)
    expect(r.program).toBeNull()
    expect(r.unknown).toEqual([expect.objectContaining({ nodeId: 'r1', construct: 'python:raw_code' })])
    // `$only` 的元件出現在不該出現的位置 → unknown，不漏出 `{"$only":…}`
    //    （第一個例子 `max(xs, key=…)` 已由 cella 對照表 c4c423b3e 修好；換成 f-string 的片段出現在 f-string 以外）
    const piece = { id: 'k1', componentId: 'python:string_insert', properties: {}, slots: {} }
    const add = { id: 'm1', componentId: 'python:arithmetic', properties: { operator: '+' }, slots: { left: [piece] } } as unknown as SemanticNode
    expect(expandPython(add, false)).toMatchObject({ program: null, unknown: [expect.objectContaining({ nodeId: 'k1' })] })
    const bad = { id: 'c1', componentId: 'python:compare', properties: { operator: '<>' }, slots: {} } as unknown as SemanticNode
    expect(expandPython(bad, false).unknown[0]).toMatchObject({ nodeId: 'c1', reason: expect.stringMatching(/運算子/) })
  })

  it('★ 浮點數照 Python 的 repr', () => {
    expect([1500, 0.1, 1e16, 1.5e-5, 1e-4, 123456789012345.6, 2].map(pyFloatRepr))
      .toEqual(['1500.0', '0.1', '1e+16', '1.5e-05', '0.0001', '123456789012345.6', '2.0'])
  })
})
