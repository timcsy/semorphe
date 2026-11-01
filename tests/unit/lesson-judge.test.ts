/**
 * **判題用哪一份輸出**（spec 200，重構階段 6b）——`core/lesson/judge.ts`。
 */
import { describe, it, expect } from 'vitest'
import { judgeOutput } from '../../src/core/lesson/judge'
import type { Verdict } from '../../src/core/verdict-diagnostics'

const v = (verdict: Verdict['verdict'], out: string, kinds: string[] = []): Verdict =>
  ({ verdict, basis: 'computed', exit: 0, out, problems: kinds.map((kind) => ({ kind })) })
const base = { readsInput: true, hasStdin: true, want: '5050\n' }

describe('判題用哪一份輸出', () => {
  it('★ 判決 accept：用判決的輸出（題目的測資），不用學生這一次打的輸入跑出來的', () => {
    const r = judgeOutput({ ...base, verdict: v('accept', '5050\n'), transcript: '15\n' })
    expect(r).toMatchObject({ source: 'verdict', comparison: { passed: true } })
  })

  it('🔴 判決 reject：輸出一樣也不算通過，說出是什麼問題（越界讀到剛好對的值）', () => {
    const r = judgeOutput({ ...base, verdict: v('reject', '5050\n', ['ubBounds', 'hole']), transcript: '5050\n' })
    expect(r).toMatchObject({ source: 'verdict-reject', why: 'ubBounds', comparison: { passed: false } })
  })

  it('★ 判決不在、判不出來：退回這一次執行的輸出，並說出原因', () => {
    expect(judgeOutput({ ...base, verdict: null, transcript: '5050\n' })).toMatchObject({ source: 'run', comparison: { passed: true }, why: expect.stringMatching(/載好/) })
    expect(judgeOutput({ ...base, verdict: v('unknown', ''), transcript: '5050\n' })).toMatchObject({ source: 'run', why: expect.stringMatching(/判不出/) })
  })

  it('🔴 程式要讀輸入、題目沒給測資：判決吃到的是空輸入——用學生這一次的，不用判決的', () => {
    const r = judgeOutput({ ...base, hasStdin: false, verdict: v('accept', '0\n'), transcript: '5050\n' })
    expect(r).toMatchObject({ source: 'run', comparison: { passed: true } })
  })
})
