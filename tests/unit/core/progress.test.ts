/**
 * @vitest-environment happy-dom
 *
 * **通過紀錄**——`core/progress.ts`。
 *
 * ⚠️ 這個檔要 DOM 環境是因為它讀 `localStorage`。`src/` 裡零個
 * 「偵測 DOM 存在」的分支，所以不加這一行的症狀是**整個檔紅**，不是靜默錯。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { markTaskPassed, isTaskPassed, passedTasks, passedCount, clearProgress } from '../../../src/core/progress'

describe('通過紀錄', () => {
  beforeEach(() => { localStorage.clear() })

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
    localStorage.setItem('semorphe-progress', '{ 這不是 JSON')
    expect(passedTasks('cpp/01')).toEqual([])
    localStorage.setItem('semorphe-progress', '"一個字串"')
    expect(passedTasks('cpp/01')).toEqual([])
    localStorage.setItem('semorphe-progress', '{"cpp/01": "不是陣列"}')
    expect(passedTasks('cpp/01')).toEqual([])
    localStorage.setItem('semorphe-progress', '{"cpp/01": ["ok", 3, null]}')
    expect(passedTasks('cpp/01')).toEqual(['ok'])
  })

  it('⚠️ 壞掉的資料被覆寫之後，新的記得住（不會卡在壞的那一份）', () => {
    localStorage.setItem('semorphe-progress', 'x')
    markTaskPassed('cpp/01', 'follow')
    expect(isTaskPassed('cpp/01', 'follow')).toBe(true)
  })
})
