/**
 * **置換的四條性質**——它們讓「每個槽自己選視圖」不會長出兩份狀態。
 *
 * 🔴 為什麼是置換而不是「槽 → 層」：**槽沒有穩定的身分**（版面一換槽數就變），
 * 而層有。用索引的話切版面就等於資料遺失。
 */
import { describe, it, expect } from 'vitest'
import { identityAssignment, swapTo, effectiveAreas } from '../../../src/core/host/slot-assignment'
import { LAYOUT_PRESETS, layoutPreset } from '../../../src/core/host/layout-presets'
import { LAYER_ORDER } from '../../../src/core/view-host'

const P = (id: string) => layoutPreset(id as never)!

describe('槽的指派是一個置換', () => {
  it('★ 入口條件：四層都在，三個版面都在', () => {
    // ⚠️ **層還是四個**（主控台仍然是一層），而**版面剩三張**
    //    ——十字退場（spec 171）。層數與版面數本來就不必相等。
    expect(LAYER_ORDER.length).toBe(4)
    expect(LAYOUT_PRESETS.length).toBe(3)
  })

  it('恆等：什麼都沒換的時候，每一層對到自己', () => {
    expect(identityAssignment()).toEqual({
      element: 'element', relation: 'relation', space: 'space', state: 'state',
    })
  })

  it('🔴 對調而不是覆蓋——原本顯示 `to` 的那一格會改成顯示 `from`', () => {
    const a = swapTo(identityAssignment(), 'space', 'relation')
    expect(a.space, '宣告 space 的那一格改成顯示 relation').toBe('relation')
    expect(a.relation, '而宣告 relation 的那一格接手 space').toBe('space')
    expect(a.element).toBe('element')
    expect(a.state).toBe('state')
  })

  it('🔴 三欄：把積木換成程式碼，兩格對調而【形狀一格都沒變】', () => {
    // 🪦 這一條本來拿十字當例子（左上與右下對調）。十字退場（spec 171）之後
    //    改用三欄——守的性質**一個字都沒變**：置換換的是「哪一格顯示誰」，不是格數。
    const before = effectiveAreas(P('three-column'), identityAssignment())
    expect(before).toEqual([['element', 'relation', 'space']])
    const after = effectiveAreas(P('three-column'), swapTo(identityAssignment(), 'space', 'element'))
    expect(after, '🔴 頭尾對調').toEqual([['space', 'relation', 'element']])
    expect(after.map((r) => r.length), '形狀變了').toEqual(before.map((r) => r.length))
  })

  it('🔴 對照：積木換成流程之後，那一格顯示流程', () => {
    const a = swapTo(identityAssignment(), 'space', 'relation')
    expect(effectiveAreas(P('compare'), a)).toEqual([['element', 'relation']])
  })

  it('★ 注入（不亂報）：換到自己身上不得改變任何東西', () => {
    const a = swapTo(identityAssignment(), 'space', 'relation')
    expect(swapTo(a, 'space', 'space')).toEqual(a)
    expect(swapTo(a, 'element', 'element')).toEqual(a)
  })

  it('★ 注入：`*`（專注）用 focusLayer 代換之後才套置換', () => {
    // ⚠️ 順序反了的話「專注」會顯示一個沒有被指派過的層
    expect(effectiveAreas(P('focus'), identityAssignment(), 'relation'))
      .toEqual([['relation']])
    expect(effectiveAreas(P('focus'), swapTo(identityAssignment(), 'relation', 'space'), 'relation'))
      .toEqual([['space']])
  })
})
