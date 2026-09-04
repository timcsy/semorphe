/**
 * **跑之前先猜一下**——`core/predict.ts`。
 *
 * 🔴 使用者 2026-09-04：「總之**目的是要使用者想過**就是」。
 * 那句話把設計推掉了一半：沒有分數、沒有猜對率、沒有全班統計，
 * 而**問不出好問題就不要問**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { predictionFor, programSignature } from '../../../src/core/predict'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createNode } from '../../../src/core/semantic-tree'
import { parseLesson } from '../../../src/core/lesson'
import type { SemanticNode } from '../../../src/core/types'
import type { LessonTask } from '../../../src/core/lesson'

beforeAll(() => { registerCppLanguage() })

const num = (v: number): SemanticNode => createNode('cpp:literal_number', { value: String(v) })
const show = (v: number): SemanticNode => createNode('cpp:print', {}, { values: [num(v)] })
const loop = (body: SemanticNode[]): SemanticNode =>
  createNode('cpp:loop_while', {}, { condition: [num(1)], body })
const prog = (...body: SemanticNode[]): SemanticNode => createNode('cpp:program', {}, { body })

const task = (over: Partial<LessonTask> = {}): LessonTask =>
  ({ id: 't', title: 't', check: { stdout: '5\n', stdin: [] }, ...over })

describe('要問什麼', () => {
  it('★ 恰好一顆迴圈 → 問「跑幾次」（答案是一個數字，而它正是差一錯誤住的地方）', () => {
    const w = loop([show(1)])
    const q = predictionFor(prog(w), task())
    expect(q?.kind).toBe('iterations')
    expect(q?.nodeId, '🔴 沒說是哪一顆——揭曉時徽章要對得上').toBe(w.id)
  })

  it('🔴 兩顆迴圈 → 不問「跑幾次」：「哪一顆」本身就有歧義', () => {
    const t = predictionFor(prog(loop([show(1)]), loop([show(2)])), task())
    // ⚠️ 它會落到「猜輸出」那一支（輸出只有一行）——重點是**不是** iterations
    expect(t?.kind).not.toBe('iterations')
  })

  it('沒有迴圈、輸出短 → 問輸出', () => {
    expect(predictionFor(prog(show(1)), task())?.kind).toBe('output')
  })

  it('🔴 輸出超過三行 → 不問：那不是預測，那是抄寫', () => {
    const t = task({ check: { stdout: '1\n2\n3\n4\n', stdin: [] } })
    expect(predictionFor(prog(show(1)), t)).toBeUndefined()
  })

  it('沒有輸出的課（只閃燈）→ 不問', () => {
    expect(predictionFor(prog(show(1)), task({ check: undefined }))).toBeUndefined()
    expect(predictionFor(prog(show(1)), task({ check: { stdout: '', stdin: [] } }))).toBeUndefined()
  })

  it('🔴 `none` 是【說出口的不問】', () => {
    expect(predictionFor(prog(loop([show(1)])), task({ predict: 'none' }))).toBeUndefined()
  })

  it('宣告贏過自動判定——作者比它更知道學生撐不撐得住', () => {
    // 12 行輸出，自動判定會放棄；而作者說要問，就問
    const t = task({ predict: 'output', check: { stdout: '1\n2\n3\n4\n5\n6\n', stdin: [] } })
    expect(predictionFor(prog(show(1)), t)?.kind).toBe('output')
  })

  it('⚠️ 宣告說問「跑幾次」而樹上不只一顆 → 不問，不要挑一顆', () => {
    const t = task({ predict: 'iterations' })
    expect(predictionFor(prog(loop([show(1)]), loop([show(2)])), t)).toBeUndefined()
    expect(predictionFor(prog(show(1)), t)).toBeUndefined()
  })

  it('沒有課／沒有題目 → 不問（純練習）', () => {
    expect(predictionFor(prog(show(1)), undefined)).toBeUndefined()
    expect(predictionFor(null, task())).toBeUndefined()
  })
})

describe('選擇題', () => {
  const base = { title: 't', pins: {}, components: ['cpp:print'] }
  const good = [
    { text: '1\n2\n3', correct: true },
    { text: '1 2 3', why: '以為 endl 是空格' },
    { text: '1\n2', why: '差一——條件是 <= 還是 <' },
  ]

  it('★ 讀得進來，而問句帶著選項', () => {
    const l = parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice', choices: good, check: { stdout: '1\n2\n3\n' } },
    ] })
    const q = predictionFor(prog(show(1)), l.tasks[0])
    expect(q?.kind).toBe('choice')
    expect(q?.choices).toHaveLength(3)
  })

  it('🔴 干擾項沒有 why → 丟錯：一個說不出誤解的干擾項只是一個隨機的錯答案', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice', choices: [
        { text: '對的', correct: true }, { text: '錯的' },
      ] },
    ] })).toThrow(/why/)
  })

  it('🔴 對的答案不是恰好一個 → 丟錯', () => {
    const two = [{ text: 'a', correct: true }, { text: 'b', correct: true }]
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice', choices: two },
    ] })).toThrow(/恰好一個/)
    const none = [{ text: 'a', why: 'w' }, { text: 'b', why: 'w' }]
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice', choices: none },
    ] })).toThrow(/恰好一個/)
  })

  it('🔴 說是 choice 而沒有選項 → 丟錯（一個沒有選項的選擇題問不出來）', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice' },
    ] })).toThrow(/沒有 choices/)
  })

  it('只有一個選項 → 丟錯', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', predict: 'choice', choices: [{ text: 'a', correct: true }] },
    ] })).toThrow(/至少要兩個/)
  })

  it('⚠️ 自動判定【不會】選中選擇題——只有作者寫了才有', () => {
    // 一顆迴圈 ＋ 沒有宣告 predict ⟹ 走「跑幾次」，不會變成選擇題
    expect(predictionFor(prog(loop([show(1)])), task())?.kind).toBe('iterations')
  })
})

describe('這支程式是不是還是剛才那一支', () => {
  it('🔴 `i < 3` 改成 `i < 4` 要算【另一支】——差一錯誤正住在那裡', () => {
    const a = prog(show(3))
    const b = prog(show(4))
    expect(programSignature(a)).not.toBe(programSignature(b))
  })

  it('一樣的結構 → 一樣的簽章（id 不同不算改）', () => {
    expect(programSignature(prog(show(1)))).toBe(programSignature(prog(show(1))))
  })

  it('多一句 → 不一樣', () => {
    expect(programSignature(prog(show(1)))).not.toBe(programSignature(prog(show(1), show(2))))
  })

  it('沒有樹 → 空字串，不要丟錯', () => {
    expect(programSignature(null)).toBe('')
  })
})

describe('宣告', () => {
  const base = { title: 't', pins: {}, components: ['cpp:print'] }

  it('讀得到 predict', () => {
    const l = parseLesson('x/y', { ...base, tasks: [{ id: 'a', title: 'A', predict: 'iterations' }] })
    expect(l.tasks[0]?.predict).toBe('iterations')
  })

  it('🔴 拼錯要當場丟錯——安靜地退回自動判定，畫面上與「沒寫」一模一樣', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [{ id: 'a', title: 'A', predict: 'ouput' }] }))
      .toThrow(/predict/)
  })
})
