/**
 * **這一課你改了哪一邊**——編輯計數（拆輪子的曲線）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  setEditTallyStore, tallyEdit, tallyOf, tallyOfTrack, clearEditTally, tallyCurve, barShare,
} from '../../../src/core/edit-tally'
import { MemoryKeyValueStore } from '../../../src/core/host/key-value-store'

beforeEach(() => setEditTallyStore(new MemoryKeyValueStore()))

describe('編輯計數', () => {
  it('分得出兩邊，而沒有記錄時是兩個零', () => {
    expect(tallyOf('t/01')).toEqual({ blocks: 0, code: 0 })
    tallyEdit('t/01', 'blocks')
    tallyEdit('t/01', 'code')
    tallyEdit('t/01', 'code')
    expect(tallyOf('t/01')).toEqual({ blocks: 1, code: 2 })
  })

  it('課與課之間不混', () => {
    tallyEdit('t/01', 'blocks')
    tallyEdit('t/02', 'code')
    expect(tallyOf('t/01')).toEqual({ blocks: 1, code: 0 })
    expect(tallyOf('t/02')).toEqual({ blocks: 0, code: 1 })
  })

  /**
   * 🔴 **自由練習不算進曲線裡**——「拆輪子」是一條課程的軌跡，
   * 而不在課程裡的編輯沒有位置可放。
   */
  it('🔴 沒有課程 id → 什麼都不做，不得爆也不得記到別人頭上', () => {
    tallyEdit(undefined, 'code')
    tallyEdit('', 'blocks')
    expect(tallyOf('')).toEqual({ blocks: 0, code: 0 })
  })

  it('整條軌道加得起來——而它只加自己那一軌', () => {
    tallyEdit('cpp-beginner/01', 'blocks')
    tallyEdit('cpp-beginner/02', 'code')
    tallyEdit('arduino/01', 'code')
    expect(tallyOfTrack('cpp-beginner')).toEqual({ blocks: 1, code: 1 })
    expect(tallyOfTrack('arduino')).toEqual({ blocks: 0, code: 1 })
    expect(tallyOfTrack('nope')).toEqual({ blocks: 0, code: 0 })
  })

  it('★ 軌道名是前綴而不是「開頭幾個字」——`cpp` 不得吃到 `cpp-beginner`', () => {
    tallyEdit('cpp-beginner/01', 'code')
    expect(tallyOfTrack('cpp'), '🔴 少了那個斜線，一條軌道會吃掉所有同前綴的軌道')
      .toEqual({ blocks: 0, code: 0 })
  })

  it('清得掉——🔴 換一班學生', () => {
    tallyEdit('t/01', 'code')
    clearEditTally()
    expect(tallyOf('t/01')).toEqual({ blocks: 0, code: 0 })
  })

  /**
   * ⚠️ 讀壞掉的資料**回空，不丟錯**——少幾個數字不值得讓整個應用停下來。
   */
  it('★ 壞掉的資料 → 回空，不得丟錯', () => {
    const store = new MemoryKeyValueStore()
    store.write('semorphe-edit-tally', '{{{ 不是 JSON')
    setEditTallyStore(store)
    expect(() => tallyOf('t/01')).not.toThrow()
    expect(tallyOf('t/01')).toEqual({ blocks: 0, code: 0 })
  })

  it('★ 形狀對但值不是數字 → 那一筆丟掉，其餘照常', () => {
    const store = new MemoryKeyValueStore()
    store.write('semorphe-edit-tally', JSON.stringify({ 'a/1': { blocks: 'x', code: 2 }, 'b/1': null }))
    setEditTallyStore(store)
    expect(tallyOf('a/1')).toEqual({ blocks: 0, code: 2 })
    expect(tallyOf('b/1')).toEqual({ blocks: 0, code: 0 })
  })
})

describe('拆輪子的曲線——三段', () => {
  it('切成前／中／後，各自加總', () => {
    for (let i = 1; i <= 9; i++) {
      tallyEdit(`t/${String(i).padStart(2, '0')}`, i <= 3 ? 'blocks' : 'code')
    }
    const c = tallyCurve(Array.from({ length: 9 }, (_, i) => `t/${String(i + 1).padStart(2, '0')}`))
    expect(c.map((s) => s.label)).toEqual(['前段', '中段', '後段'])
    expect(c[0]).toMatchObject({ lessons: 3, blocks: 3, code: 0 })
    expect(c[2]).toMatchObject({ lessons: 3, blocks: 0, code: 3 })
  })

  /**
   * 🔴 **往上走的曲線也誠實地畫**——那不是羞辱，那是一個學生自己看得懂的訊號。
   */
  it('★ 越來越靠積木的曲線照樣畫得出來', () => {
    for (let i = 1; i <= 6; i++) tallyEdit(`t/${i}`, i <= 3 ? 'code' : 'blocks')
    const c = tallyCurve(['t/1', 't/2', 't/3', 't/4', 't/5', 't/6'])
    expect(c[0]!.code).toBeGreaterThan(c[0]!.blocks)
    expect(c[2]!.blocks).toBeGreaterThan(c[2]!.code)
  })

  it('少於 3 課 → 一段「全部」，不硬切', () => {
    tallyEdit('t/1', 'code')
    expect(tallyCurve(['t/1', 't/2']).map((s) => s.label)).toEqual(['全部'])
    expect(tallyCurve([])).toEqual([])
  })

  /**
   * ⚠️ 「還沒開始」與「一半一半」是兩件事。
   */
  it('★ 兩邊都是 0 → 兩個都給 0，不是 50/50', () => {
    expect(barShare(0, 0)).toEqual({ blocks: 0, code: 0 })
    expect(barShare(2, 6)).toEqual({ blocks: 0.25, code: 0.75 })
  })
})
