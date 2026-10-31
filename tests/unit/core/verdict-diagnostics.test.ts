/**
 * 判決 → 診斷（spec 182，`core/verdict-diagnostics.ts`）——契約的五條不變式
 * （`specs/182-cella-verdict-provider/contracts/verdict-diagnostics.md`）。
 */
import { describe, it, expect } from 'vitest'
import { toDiagnostics, type Verdict } from '../../../src/core/verdict-diagnostics'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'

const idx = createNode('cpp:array_at', {}, {})
const call = createNode('cpp:func_call', { name: 'foo' }, {})
const tree: SemanticNode = createNode('cpp:program', {}, { body: [createNode('cpp:print', {}, { values: [idx, call] })] })
const v = (verdict: Verdict['verdict'], problems: Verdict['problems'] = [], assumes?: Verdict['assumes']): Verdict =>
  ({ verdict, basis: 'computed', exit: 0, out: '', problems, ...(assumes ? { assumes } : {}) })
const run = (verdict: Verdict | null, opts: { readsInput?: boolean; hasStdin?: boolean } = {}) =>
  toDiagnostics({ verdict, types: null, tree, readsInput: opts.readsInput ?? false, hasStdin: opts.hasStdin ?? false })

describe('判決 → 診斷', () => {
  it('★ accept：0 則診斷（不產生「通過」雜訊）', () => {
    expect(run(v('accept')).diagnostics).toEqual([])
  })

  it('★ reject：標在 problem 指到的節點，error、來源 cella、中文說明', () => {
    const { diagnostics } = run(v('reject', [{ kind: 'ubBounds', at: idx.id, clause: 'C++17 [expr.add]', reason: 'pointer out of bounds' }]))
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ nodeId: idx.id, severity: 'error', source: 'cella', rule: 'CELLA_UB_BOUNDS' })
    expect(diagnostics[0].params).toMatchObject({ clause: 'C++17 [expr.add]', reason: 'pointer out of bounds' })
  })

  it('🔴 尚未支援的構造：永遠是 info，不是 error（P6：系統能力不足不是學生的錯）', () => {
    const { diagnostics } = run(v('unknown', [{ kind: 'unsupported', at: call.id, reason: 'foo is not modeled yet' }]))
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('info')
  })

  it('★ 標籤 `<id>/<角色>`、`<id>#<槽>` 歸到那一顆；樹裡沒有的往上找不到就只進 notes', () => {
    const a = run(v('reject', [{ kind: 'ubUninit', at: `${idx.id}/value` }])).diagnostics
    const b = run(v('unknown', [{ kind: 'hole', at: `${idx.id}#index` }])).diagnostics
    expect(a[0].nodeId).toBe(idx.id)
    expect(b).toEqual([])   // 洞＝還沒寫完，不顯示
    const c = run(v('reject', [{ kind: 'ubUninit', at: 'node_does_not_exist' }]))
    expect(c.diagnostics).toEqual([])
    expect(c.notes.join()).toMatch(/對不到/)
  })

  it('🔴 要讀輸入而沒有測資：丟掉 ub*／fuel，留一句「需要輸入」（SC-005）', () => {
    const problems = [{ kind: 'ubUninit', at: idx.id }, { kind: 'fuel', at: idx.id }, { kind: 'unsupported', at: call.id }]
    const r = run(v('reject', problems), { readsInput: true, hasStdin: false })
    expect(r.diagnostics.map((d) => d.rule)).toEqual(['CELLA_UNSUPPORTED'])
    expect(r.notes.join()).toMatch(/輸入/)
    const withStdin = run(v('reject', problems), { readsInput: true, hasStdin: true })
    expect(withStdin.diagnostics).toHaveLength(3)
  })

  it('★ 能力缺（沒有提供者／載入失敗）：0 則，notes 說需要 Cella', () => {
    const r = run(null)
    expect(r.diagnostics).toEqual([])
    expect(r.notes.join()).toMatch(/Cella/)
  })

  it('★ 帶 assumes 的 accept：沒有 error，notes 有「依 libc++」', () => {
    const r = run(v('accept', [], [{ implementation: 'libc++', choice: 'vector.growth' }]))
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(r.notes.join()).toMatch(/依 libc\+\+/)
  })
})

describe('型別查詢 → 診斷（US4）', () => {
  it('★ errors 指到的那一句標 type_mismatch（允許接上、標錯）；判決已經 reject 同一顆時不重複', () => {
    const types = { errors: [{ at: `${idx.id}/value`, reason: 'cannot convert std::string to int' }] }
    const r = toDiagnostics({ verdict: v('accept'), types, tree, readsInput: false, hasStdin: false })
    expect(r.diagnostics).toEqual([expect.objectContaining({ nodeId: idx.id, severity: 'error', rule: 'TYPE_MISMATCH' })])
    const both = toDiagnostics({ verdict: v('reject', [{ kind: 'reject', at: idx.id }]), types, tree, readsInput: false, hasStdin: false })
    expect(both.diagnostics.map((d) => d.rule)).toEqual(['CELLA_REJECT'])
  })

  it('★ 洞的 fits（放什麼合）不產生診斷', () => {
    const types = { slots: { [`${idx.id}#index`]: { expects: 'int', fits: { 'char *': { level: 'no' as const, reason: 'x' } } } } }
    expect(toDiagnostics({ verdict: v('unknown', [{ kind: 'hole', at: `${idx.id}#index` }]), types, tree, readsInput: false, hasStdin: false }).diagnostics).toEqual([])
  })
})
