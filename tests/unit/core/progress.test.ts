/**
 * **通過紀錄**——`core/progress.ts`。
 *
 * 🪦 **這個檔曾經需要 `@vitest-environment happy-dom`**，而理由逐字是
 * 「它讀 `localStorage`」。2026-09-06（spec 173）之後不需要了：
 * 存放變成一個**注入的埠**，而測試注入記憶體那一個。
 *
 * > **一個「因為它碰 DOM 所以測試要有 DOM」的檔案，
 * > 多半是它碰了一個不該碰的東西——而那件事在測試環境上先浮出來。**
 *
 * ⚠️ 而重置也跟著變乾淨：從 `localStorage.clear()`（一個**全域**的副作用）
 * 變成「換一個新的 store」——測試之間再也不可能互相污染。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { markTaskPassed, isTaskPassed, passedTasks, passedCount, clearProgress, setProgressStore } from '../../../src/core/progress'
import { MemoryKeyValueStore } from '../../../src/core/host/key-value-store'

describe('通過紀錄', () => {
  beforeEach(() => { setProgressStore(new MemoryKeyValueStore()) })

  it('記得住，而且分課', () => {
    markTaskPassed('cpp/01', 'follow')
    expect(isTaskPassed('cpp/01', 'follow')).toBe(true)
    // 🔴 **同名的題目在別課不算過**——`ex1` 這個 id 每一課都會有
    expect(isTaskPassed('cpp/02', 'follow')).toBe(false)
  })

  it('同一題記兩次不會變成兩筆', () => {
    markTaskPassed('cpp/01', 'ex1')
    markTaskPassed('cpp/01', 'ex1')
    expect(passedTasks('cpp/01')).toEqual(['ex1'])
  })

  it('★ 選單上那個「2/3」', () => {
    markTaskPassed('cpp/01', 'follow')
    markTaskPassed('cpp/01', 'ex2')
    expect(passedCount('cpp/01', ['follow', 'ex1', 'ex2'])).toBe(2)
    // ⚠️ 紀錄裡有、而這一課已經沒有的題目**不算**——課改了之後
    //    分母會變，而分子不該還記著一個不存在的題目
    expect(passedCount('cpp/01', ['ex1'])).toBe(0)
  })

  it('🔴 清得掉——一台電腦換一班學生是最可能的部署方式', () => {
    markTaskPassed('cpp/01', 'follow')
    clearProgress()
    expect(passedTasks('cpp/01')).toEqual([])
  })

  it('🔴 讀到壞掉的資料回空，不要丟錯', () => {
    // ⚠️ 直接往 store 裡塞壞資料——在此之前這裡塞的是 `localStorage`，
    //    而那是一個**全域**：兩個測試檔同時跑會互相看到對方的髒資料。
    const bad = new MemoryKeyValueStore()
    setProgressStore(bad)
    bad.write('semorphe-progress', '{ 這不是 JSON')
    expect(passedTasks('cpp/01')).toEqual([])
    bad.write('semorphe-progress', '"一個字串"')
    expect(passedTasks('cpp/01')).toEqual([])
    bad.write('semorphe-progress', '{"cpp/01": "不是陣列"}')
    expect(passedTasks('cpp/01')).toEqual([])
    bad.write('semorphe-progress', '{"cpp/01": ["ok", 3, null]}')
    expect(passedTasks('cpp/01')).toEqual(['ok'])
  })

  it('⚠️ 壞掉的資料被覆寫之後，新的記得住（不會卡在壞的那一份）', () => {
    const store = new MemoryKeyValueStore()
    setProgressStore(store)
    store.write('semorphe-progress', 'x')
    markTaskPassed('cpp/01', 'follow')
    expect(isTaskPassed('cpp/01', 'follow')).toBe(true)
  })
})
