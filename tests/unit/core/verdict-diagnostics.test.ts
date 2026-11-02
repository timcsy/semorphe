/**
 * 判決 → 診斷（spec 182，`core/verdict-diagnostics.ts`）——契約的五條不變式
 * （`specs/182-cella-verdict-provider/contracts/verdict-diagnostics.md`）。
 */
import { describe, it, expect } from 'vitest'
import { toDiagnostics, type Verdict } from '../../../src/core/verdict-diagnostics'
import { ownerOf } from '../../../src/core/verdict-diagnostics'
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

  it('★ 標籤 `<id>/<角色>`、`<id>#<槽>` 歸到那一顆；樹裡沒有的畫不上積木、進 notes', () => {
    const a = run(v('reject', [{ kind: 'ubUninit', at: `${idx.id}/value` }])).diagnostics
    const b = run(v('unknown', [{ kind: 'hole', at: `${idx.id}#index` }])).diagnostics
    expect(a[0].nodeId).toBe(idx.id)
    expect(b).toEqual([])   // 洞＝還沒寫完，不顯示
    const c = run(v('reject', [{ kind: 'ubUninit', at: 'node_does_not_exist' }]))
    expect(c.diagnostics).toEqual([])
    expect(c.notes.join()).toMatch(/對不到/)
    expect(c.unplaced).toEqual({ error: 1, info: 0 })
  })

  it('🔴 對不到積木的問題照嚴重度計數——步數用盡（`at` 是空的）不能讓狀態列說「沒有發現問題」（P6）', () => {
    const r = run(v('unknown', [{ kind: 'fuel', at: '', clause: '', reason: 'step limit reached' }]))
    expect(r.diagnostics).toEqual([])
    expect(r.unplaced).toEqual({ error: 0, info: 1 })
    expect(run(v('accept')).unplaced).toEqual({ error: 0, info: 0 })
  })

  it('★ 求值順序未指定（`ubOrder`）是「標準允許不只一種」——info、中文的那一則，不是 CELLA_OTHER 的英文原文', () => {
    const { diagnostics } = run(v('unknown', [{ kind: 'ubOrder', at: call.id, clause: 'C++17 [intro.execution]p11', reason: 'the order of evaluation is unspecified' }]))
    expect(diagnostics[0]).toMatchObject({ nodeId: call.id, severity: 'info', rule: 'CELLA_UNSPECIFIED' })
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

  it('★ 帶 assumes 的 accept：沒有 error（不改綠紅），assumes 單獨交出、帶中文說明（第 14 題的小標）', () => {
    const r = run(v('accept', [], [{ implementation: 'libc++', choice: 'vector.growth' }, { implementation: 'libc++', choice: 'some.new' }]))
    expect(r.diagnostics).toEqual([])
    expect(r.assumes).toEqual([
      { implementation: 'libc++', text: expect.stringMatching(/vector 的容量/) },
      { implementation: 'libc++', text: 'some.new' },   // 表上沒有的：原文，不丟掉
    ])
    expect(r.notes.join()).not.toMatch(/libc\+\+/)
  })

  it('🔴 擔保者照判決說的（cella 0.1.202610312349 起不再一律是 libc++）：glibc 的亂數、執行環境的時鐘', () => {
    const r = run(v('accept', [], [{ implementation: 'glibc', choice: 'rand.sequence' }, { implementation: 'environment', choice: 'time.now' }]))
    expect(r.assumes).toEqual([
      { implementation: 'glibc', text: expect.stringMatching(/rand\(\)/) },
      { implementation: '執行環境', text: expect.stringMatching(/time\(\)/) },
    ])
  })

  it('★ 只寫 <bits/stdc++.h>：依 libstdc++ 的標頭內容（cella 2026-11-02 預告），說明是中文、不是代號', () => {
    const r = run(v('accept', [], [{ implementation: 'libstdc++', choice: 'header.contents' }]))
    expect(r.assumes).toEqual([{ implementation: 'libstdc++', text: expect.stringMatching(/bits\/stdc\+\+\.h/) }])
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

describe('Cella 的節點標籤 → 語義樹的節點', () => {
  it('🔴 範圍 for 合成的運算式（`:begin`、`:element`…；cella 2026-11-01）對回範圍 for 本身', () => {
    expect(ownerOf('node_7_ab:element')).toBe('node_7_ab')
    expect(ownerOf('node_7_ab:begin')).toBe('node_7_ab')
    expect(ownerOf('node_7_ab/stmt')).toBe('node_7_ab')
    expect(ownerOf('node_7_ab#obj')).toBe('node_7_ab')
    expect(ownerOf('node_7_ab')).toBe('node_7_ab')
  })
})

/**
 * spec 206：**近似名的建議搬到判決診斷**——它原本住在 JS 直譯器（`interpreter/scope.ts` 的 `undeclared`），6c-4 刪直譯器就沒地方放
 * （6c 測試盤點的 F 類）。Cella 判「use of undeclared identifier 'X'」時，在語意樹宣告過的名字 ＋ 語言給的常用名字裡找近似名。
 * 規矩照舊：**寧可漏，不可錯**——找不到就照原本的 CELLA_REJECT，一個字都不多。
 */
describe('近似名的建議（Cella 判未宣告）', () => {
  const use = createNode('cpp:var_ref', { name: 'Cout' }, {})
  const decl = createNode('cpp:var_declare', { name: 'score', type: 'int' }, {})
  const use2 = createNode('cpp:var_ref', { name: 'scoer' }, {})
  const t = createNode('cpp:program', {}, { body: [decl, createNode('cpp:print', {}, { values: [use, use2] })] })
  const undeclared = (at: string, name: string): Verdict => v('reject', [{ kind: 'reject', at, reason: `use of undeclared identifier '${name}'` }])
  const go = (verdict: Verdict, knownNames: string[] = []) =>
    toDiagnostics({ verdict, types: null, tree: t, readsInput: false, hasStdin: false, knownNames })

  it('★ 語言給的常用名字：Cout → 是不是要寫 cout', () => {
    const d = go(undeclared(use.id, 'Cout'), ['cout', 'cin', 'endl']).diagnostics
    expect(d).toEqual([expect.objectContaining({ nodeId: use.id, rule: 'CELLA_UNDECLARED_SUGGEST', params: expect.objectContaining({ name: 'Cout', near: 'cout' }) })])
  })
  it('★ 樹裡宣告過的名字：scoer → 是不是要寫 score（相鄰兩字對調也算）', () => {
    const d = go(undeclared(use2.id, 'scoer')).diagnostics
    expect(d[0]).toMatchObject({ rule: 'CELLA_UNDECLARED_SUGGEST', params: { name: 'scoer', near: 'score' } })
  })
  it('🔴 找不到近似名 → 照原本的 CELLA_REJECT，不亂猜', () => {
    const d = go(undeclared(use.id, 'qqqq'), ['cout']).diagnostics
    expect(d[0]).toMatchObject({ rule: 'CELLA_REJECT' })
  })
  it('不是未宣告的 reject 不受影響', () => {
    const d = go(v('reject', [{ kind: 'reject', at: use.id, reason: 'invalid operands to a binary operator' }]), ['cout']).diagnostics
    expect(d[0]).toMatchObject({ rule: 'CELLA_REJECT' })
  })
})
