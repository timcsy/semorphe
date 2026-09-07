/**
 * **這一課你改了哪一邊**——編輯計數（拆輪子的曲線）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  setEditTallyStore, tallyEdit, tallyOf, tallyOfTrack, clearEditTally,
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
