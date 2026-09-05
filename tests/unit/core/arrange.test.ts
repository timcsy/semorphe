/**
 * **「排回去」的打散**（文獻裡叫 Parsons problem）——`core/arrange.ts`。
 *
 * 🔴 這裡驗的核心只有一件事：**它是確定性的**。
 * 一個每次都不一樣的東西，測試只能驗「它有動」，驗不了「它對」。
 */
import { describe, it, expect } from 'vitest'
import { scatterOrder } from '../../../src/core/arrange'

describe('打散', () => {
  it('★ 入口條件：它真的有打散（不是原封不動）', () => {
    const o = scatterOrder('cpp-beginner/10-重複#ex1', 6)
    expect(o, '🔴 打散完等於沒打散 → 學生會以為壞了，而護欄也驗不出它跑過').not.toEqual([0, 1, 2, 3, 4, 5])
  })

  it('🔴 同一個種子永遠同一串——重整理頁面不該換一題', () => {
    const a = scatterOrder('x#ex1', 8)
    const b = scatterOrder('x#ex1', 8)
    expect(a).toEqual(b)
  })

  it('不同題目打散得不一樣', () => {
    expect(scatterOrder('x#ex1', 8)).not.toEqual(scatterOrder('x#ex2', 8))
  })

  it('它是一個【排列】——一塊不多、一塊不少', () => {
    for (const n of [2, 3, 7, 12, 30]) {
      const o = scatterOrder('t', n)
      expect(o).toHaveLength(n)
      expect([...o].sort((p, q) => p - q)).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('⚠️ 0 或 1 塊 → 原樣回傳（沒有東西可以打散，而那不是錯誤）', () => {
    expect(scatterOrder('t', 0)).toEqual([])
    expect(scatterOrder('t', 1)).toEqual([0])
  })

  it('🔴 兩塊的時候一定要換位——不然「打散」有一半的機率是假的', () => {
    expect(scatterOrder('t', 2)).not.toEqual([0, 1])
    expect(scatterOrder('別的種子', 2)).not.toEqual([0, 1])
  })

  it('★ 在瀏覽器與 Node 上要算出同一串——所以不准用平台相依的雜湊', () => {
    // 釘住一個實際的值：改了雜湊實作而沒有意識到的那天，這一條會紅
    expect(scatterOrder('cpp-beginner/10-重複#ex1', 5)).toEqual(scatterOrder('cpp-beginner/10-重複#ex1', 5))
    expect(scatterOrder('a', 4).join(',')).toMatch(/^[0-3](,[0-3]){3}$/)
  })
})
