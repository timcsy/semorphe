/**
 * **執行覆蓋**：這一次跑到過哪些節點。
 *
 * 🔴 它守的是**回饋**，不是正確性——初學者的 bug 有壓倒性的比例是這兩種：
 * 「這一段從來沒跑到」與「跑的次數不對」，而這份資料是前者的來源。
 *
 * ⚠️ 而「沒到過」**不等於「錯」**：一個 `if` 的另一支本來就可能不該跑。
 * 所以它的用途是**問一句**，不是判對錯——見 `getVisitedNodes` 的說明。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createNode } from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'

beforeAll(() => { registerCppLanguage() })

const str = (v: string): SemanticNode => createNode('cpp:literal_string', { value: v })
const show = (x: SemanticNode): SemanticNode => createNode('cpp:print', {}, { values: [x] })
const prog = (...body: SemanticNode[]): SemanticNode => createNode('cpp:program', {}, { body })

describe('執行覆蓋', () => {
  it('★ 入口條件：真的記到東西（0 個的話下面每一條都是空轉）', async () => {
    const i = new SemanticInterpreter()
    await i.execute(prog(show(str('a'))))
    expect(i.getVisitedNodes().size).toBeGreaterThan(1)
  })

  it('跑過的節點會被記下來', async () => {
    const i = new SemanticInterpreter()
    const hi = show(str('hi'))
    await i.execute(prog(hi))
    expect(i.getVisitedNodes().has(hi.id)).toBe(true)
  })

  it('🔴 沒掛進樹裡的不在裡面——這就是「這一段從來沒被跑到」的來源', async () => {
    const i = new SemanticInterpreter()
    const ran = show(str('a'))
    const never = show(str('b'))
    await i.execute(prog(ran))
    expect(i.getVisitedNodes().has(ran.id)).toBe(true)
    expect(i.getVisitedNodes().has(never.id)).toBe(false)
  })

  it('★ 次數也記得住——「迴圈跑了幾次」的原料', async () => {
    const i = new SemanticInterpreter()
    const body = show(str('x'))
    const w = createNode('cpp:loop_while', {}, {
      condition: [createNode('cpp:compare', { operator: '<' }, {
        left: [createNode('cpp:literal_number', { value: '0' })],
        right: [createNode('cpp:literal_number', { value: '3' })],
      })],
      body: [body],
    })
    // ⚠️ 上面那個條件永遠成立 → 會撞步數上限而停，但**次數已經記下來了**
    await i.execute(prog(w)).catch(() => {})
    const counts = i.getVisitCounts()
    // 🔴 迴圈**自己**只被走一次，而身體被走了很多次——「跑了幾次」是那個倍數
    expect(counts.get(w.id), '🔴 迴圈自己不是 1 的話，倍數的分母就錯了').toBe(1)
    expect(counts.get(body.id) ?? 0, '🔴 身體沒有被數').toBeGreaterThan(1)
  })

  it('🔴 每一次開跑都要清——不清的話「沒跑到的」會越來越少，看起來像自己好了', async () => {
    const i = new SemanticInterpreter()
    const first = show(str('a'))
    await i.execute(prog(first))
    expect(i.getVisitedNodes().has(first.id)).toBe(true)
    const second = show(str('b'))
    await i.execute(prog(second))
    expect(i.getVisitedNodes().has(first.id), '🔴 上一次的殘留在這一次裡').toBe(false)
    expect(i.getVisitedNodes().has(second.id)).toBe(true)
  })
})
