import { describe, it, expect } from 'vitest'
import { compareInterpretations } from '../../../../src/core/disambiguation/compare'
import type { Judge, RunOutcome, Scenario } from '../../../../src/core/disambiguation/types'
import type { SemanticNode } from '../../../../src/core/types'

const T = (id: string): SemanticNode => ({ id, componentId: 'x:program', properties: {}, slots: {} }) as SemanticNode
const S = (n: number): Scenario => ({ kind: 'fake', payload: n, label: `#${n}` })
const ok = (out: string): RunOutcome => ({ verdict: 'accept', out, problems: [] })
// 假的判決：表格 program id → scenario payload → outcome
const judgeFrom = (table: Record<string, (n: number) => RunOutcome>): Judge => async (tree, s) => table[tree.id](s.payload as number)

describe('比對器（spec 218）', () => {
  const scenarios = [S(0), S(1), S(2)]
  const refs = [{ id: 'a', label: 'A', tree: T('A') }, { id: 'b', label: 'B', tree: T('B') }]
  const judge = judgeFrom({
    A: (n) => ok(`${n}`),
    B: (n) => ok(n === 2 ? 'x' : `${n}`),
    studentA: (n) => ok(`${n}`),
    studentNone: (n) => ok(`${n + 10}`),
    studentUb: (n) => (n === 1 ? { verdict: 'reject', out: '', problems: [{ kind: 'ubBounds', reason: 'out of range' }] } : ok(`${n}`)),
  })

  it('和 A 一致；和 B 第一個不一致是情境 #2，附兩邊輸出', async () => {
    const r = await compareInterpretations(T('studentA'), refs, scenarios, judge)
    expect(r.results.map((x) => [x.id, x.status])).toEqual([['a', 'consistent'], ['b', 'inconsistent']])
    const m = r.results[1].firstMismatch!
    expect([m.scenario.label, m.student.out, m.reference.out]).toEqual(['#2', '2', 'x'])
  })
  it('都不符：兩個都不一致', async () => {
    const r = await compareInterpretations(T('studentNone'), refs, scenarios, judge)
    expect(r.results.map((x) => x.status)).toEqual(['inconsistent', 'inconsistent'])
  })
  it('判決不是 accept 的情境：照實標不可比，不算一致也不算不一致（FR-008）', async () => {
    const r = await compareInterpretations(T('studentUb'), refs, scenarios, judge)
    expect(r.results[0].status).toBe('consistent') // #0、#2 可比且相同
    expect(r.results[0].incomparable).toEqual([{ scenario: S(1), side: 'student', verdict: 'reject', reason: 'ubBounds：out of range' }])
  })
  it('分不出的解讀群：兩份解答在這批情境下輸出完全相同', async () => {
    const r = await compareInterpretations(T('studentA'), [refs[0], { id: 'a2', label: 'A2', tree: T('A') }], scenarios, judge)
    expect(r.indistinguishable).toEqual([['a', 'a2']])
  })
  it('只有一個解讀：就是對錯（FR-009）', async () => {
    const r = await compareInterpretations(T('studentNone'), [refs[0]], scenarios, judge)
    expect(r.results).toHaveLength(1)
    expect(r.results[0].status).toBe('inconsistent')
  })
  it('一個可比的情境都沒有 → incomparable', async () => {
    const all = judgeFrom({ A: () => ok('1'), s: () => ({ verdict: 'pending', out: '', problems: [] }) })
    const r = await compareInterpretations(T('s'), [refs[0]], [S(0)], all)
    expect(r.results[0].status).toBe('incomparable')
  })
})
