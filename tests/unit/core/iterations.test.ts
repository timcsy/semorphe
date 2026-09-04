/**
 * **迴圈跑了幾次**——`core/iterations.ts`。
 *
 * 🔴 這裡驗的是那個換算：迴圈**自己**只被走一次，「跑了幾次」是
 * **身體比自己多出來的倍數**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { iterationCounts } from '../../../src/core/iterations'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'

beforeAll(() => { registerCppLanguage() })

const num = (v: number): SemanticNode => createNode('cpp:literal_number', { value: String(v) })
const show = (v: number): SemanticNode => createNode('cpp:print', {}, { values: [num(v)] })
const whileLoop = (cond: SemanticNode, body: SemanticNode[]): SemanticNode =>
  createNode('cpp:loop_while', {}, { condition: [cond], body })
const prog = (...body: SemanticNode[]): SemanticNode => createNode('cpp:program', {}, { body })

describe('迴圈跑了幾次', () => {
  it('★ 入口條件：`control_flow: loop` 這個標註真的讀得到', () => {
    // 🔴 讀不到的話下面每一條都是「回空 → 期望也是空」的空轉
    const body = show(1)
    const w = whileLoop(num(1), [body])
    const got = iterationCounts(prog(w), new Map([[w.id, 1], [body.id, 5]]))
    expect(got.size, '🔴 一個迴圈都認不出來 → 這個檔什麼都沒驗').toBe(1)
  })

  it('身體 5、自己 1 → ×5', () => {
    const body = show(1)
    const w = whileLoop(num(1), [body])
    expect(iterationCounts(prog(w), new Map([[w.id, 1], [body.id, 5]])).get(w.id)).toBe(5)
  })

  it('🔴 巢狀：內層是【倍數】不是總次數——×12 會讓學生想「我明明寫 4」', () => {
    const inner = show(1)
    const innerLoop = whileLoop(num(1), [inner])
    const outer = whileLoop(num(1), [innerLoop])
    const got = iterationCounts(prog(outer), new Map([
      [outer.id, 1], [innerLoop.id, 3], [inner.id, 12],
    ]))
    expect(got.get(outer.id), '外層：3 ÷ 1').toBe(3)
    expect(got.get(innerLoop.id), '🔴 內層要是 4（12 ÷ 3），不是 12').toBe(4)
  })

  it('🔴 `for` 的四個槽——槽名是 `cond` 不是 `condition`（實測踩到的）', () => {
    // 🪦 第一版寫死 `slot === 'condition'`，於是 `for` 的條件被算進分子。
    //    症狀不是報錯：巢狀 `for` 標成 ×5／×4，而正確是 3／4——
    //    **一個看起來很合理的錯數字**。
    const init = num(0), cond = num(1), update = num(1), body = show(1)
    const f = createNode('cpp:loop_for', {}, {
      init: [init], cond: [cond], update: [update], body: [body],
    })
    const got = iterationCounts(prog(f), new Map([
      [f.id, 1], [init.id, 1], [cond.id, 4], [update.id, 3], [body.id, 3],
    ]))
    expect(got.get(f.id), '🔴 條件（4 次）或 init 被算進分子了').toBe(3)
  })

  it('🔴 條件不算分子——`while (n <= 5)` 的條件跑 6 次，而它不是「跑了幾次」', () => {
    const cond = num(1)
    const body = show(1)
    const w = whileLoop(cond, [body])
    const got = iterationCounts(prog(w), new Map([[w.id, 1], [cond.id, 6], [body.id, 5]]))
    expect(got.get(w.id), '🔴 標成 ×6 ——而這個功能正是要幫學生抓多一少一').toBe(5)
  })

  it('⚠️ ×1 不收（雜訊），×0 不收（覆蓋已經標過了）', () => {
    const b1 = show(1); const once = whileLoop(num(1), [b1])
    expect(iterationCounts(prog(once), new Map([[once.id, 1], [b1.id, 1]])).size).toBe(0)
    const b0 = show(1); const never = whileLoop(num(1), [b0])
    expect(iterationCounts(prog(never), new Map([[never.id, 1]])).size).toBe(0)
  })

  it('🔴 不是迴圈的東西不收——【讀宣告，不由結構猜】', () => {
    // 一個被呼叫多次的函式，它的身體也「跑得比自己多」，而它不是迴圈
    const body = show(1)
    const f = createNode('cpp:func_def', { name: 'f' }, { body: [body] })
    expect(
      iterationCounts(prog(f), new Map([[f.id, 1], [body.id, 5]])).size,
      '🔴 把函式標成 ×5——那句話不假，卻不是「迴圈跑了幾次」',
    ).toBe(0)
  })

  it('沒有樹 → 回空，不要丟錯', () => {
    expect(iterationCounts(null, new Map()).size).toBe(0)
    expect(iterationCounts(undefined, new Map()).size).toBe(0)
  })
})
