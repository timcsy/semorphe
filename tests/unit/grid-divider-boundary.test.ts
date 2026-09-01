/**
 * 🔴 「這是第幾條縫」在有 0px 軌道時會錯開一格。
 *
 * 2026-09-01 使用者在 VSCode 回報「**這拉不動**」，而網頁版好好的。
 * 差別是 VSCode 沒有程式碼欄與主控台（在 IDE 自己那裡），那兩條軌道是 0px。
 */
import { describe, it, expect } from 'vitest'
import { boundaryAt } from '../../src/ui/layout/grid-dividers'

const GAP = 4

describe('一條縫分開的是哪兩條軌道', () => {
  describe('網頁版：四層都在，沒有 0px 軌道', () => {
    // 三欄：`0 | 400 | 400`，起點 0 / 404 / 808
    const sizes = [400, 400, 400]
    it('第一條縫（x=404）分開 0 與 1', () => {
      expect(boundaryAt(sizes, GAP, 404)).toEqual([0, 1])
    })
    it('第二條縫（x=808）分開 1 與 2', () => {
      expect(boundaryAt(sizes, GAP, 808)).toEqual([1, 2])
    })
    it('容器左緣不是縫', () => {
      expect(boundaryAt(sizes, GAP, 0)).toBeNull()
    })
  })

  describe('🔴 VSCode：程式碼欄收成 0px', () => {
    // 三欄在 VSCode：`0px | 600 | 600`，起點 0 / 4 / 608
    const sizes = [0, 600, 600]

    it('🔴 使用者真正抓的那一條（x=608）要拖得動 1↔2', () => {
      // 舊寫法在這裡查到「第 1 條有內容的軌道是 2，而沒有第 2 條」→ 直接 return。
      expect(boundaryAt(sizes, GAP, 608)).toEqual([1, 2])
    })

    it('🔴 0px 軌道在容器左緣留下的那條假縫，不得回傳一對', () => {
      // 舊寫法在這裡回 [1,2]——**把手在錯的地方，拖的卻是對的一對**。
      expect(boundaryAt(sizes, GAP, 4)).toBeNull()
    })
  })

  describe('十字在 VSCode：整條左欄都收掉', () => {
    // 列：`0px | 500`（程式碼／主控台那一欄整條沒有）
    it('0px 在後面時也不得回傳一對', () => {
      expect(boundaryAt([500, 0], GAP, 504)).toBeNull()
    })
  })

  it('不落在任何軌道起點上的位置，不是縫', () => {
    expect(boundaryAt([400, 400], GAP, 200)).toBeNull()
  })

  it('小數位置容許 1px 誤差——rect 給的是小數', () => {
    expect(boundaryAt([400, 400], GAP, 403)).toEqual([0, 1])
    expect(boundaryAt([400, 400], GAP, 405)).toEqual([0, 1])
    expect(boundaryAt([400, 400], GAP, 407)).toBeNull()
  })
})
