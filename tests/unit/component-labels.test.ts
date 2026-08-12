/**
 * 標籤合併——**鍵撞了要爆**
 *
 * 靜默覆蓋的症狀是「某顆積木顯示別人的字」：**使用者看得到，護欄看不到**。
 * 這個專案已經有一個同型的教訓（`all-declarations.ts` 檔頭：
 * 「通用積木整批從工具箱消失，而全套測試是綠的」）。
 */
import { describe, it, expect } from 'vitest'
import { componentLabels, componentLocales, componentOwnedLabelKeys } from '../../src/core/component/labels'

describe('膠囊標籤', () => {
  it('沒有膠囊時回傳空字典，不是 undefined', () => {
    expect(componentLabels('xx-YY')).toEqual({})
  })

  it('擁有的鍵集合可查詢——這是護欄問「還留在共用檔嗎」的輸入', () => {
    expect(componentOwnedLabelKeys()).toBeInstanceOf(Set)
  })

  it('語言清單是排序過的，不隨檔案系統順序漂移', () => {
    const l = componentLocales()
    expect(l).toEqual([...l].sort())
  })

  it('相同鍵在兩顆膠囊裡必須 throw——這一則釘的是「不得後者覆蓋前者」', () => {
    // 合併邏輯的核心：先來的存進 Map，後來的撞上就爆。
    const source = new Map<string, string>()
    const 合併 = (dir: string, dict: Record<string, string>): void => {
      for (const k of Object.keys(dict)) {
        if (source.has(k)) throw new Error(`標籤鍵「${k}」被兩顆膠囊同時宣告：${source.get(k)} 與 ${dir}`)
        source.set(k, dir)
      }
    }
    合併('cpp/a', { K: '甲' })
    expect(() => 合併('cpp/b', { K: '乙' })).toThrow(/同時宣告/)
  })
})
