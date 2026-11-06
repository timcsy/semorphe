/** 執行被擋時說得出在哪、是什麼（2026-11-06，漏分號提示） */
import { describe, it, expect } from 'vitest'
import { describeExecutionRefusal } from '../../../src/core/refusal-message'

describe('describeExecutionRefusal：語法那一種接上第一個缺口', () => {
  it('★ 有位置時接在後面', () => {
    expect(describeExecutionRefusal(1, 'syntax', '第 4 行：這一行的結尾可能少了一個 `;`'))
      .toBe('這段程式有一處語法還不完整（第 4 行：這一行的結尾可能少了一個 `;`），所以還不能執行。你打的程式沒有被改動——補好之後再按一次執行就可以了。')
  })
  it('★ 沒有位置時照舊（不湊一句）', () => {
    expect(describeExecutionRefusal(2, 'syntax')).toBe('這段程式有 2 處語法還不完整，所以還不能執行。你打的程式沒有被改動——補好之後再按一次執行就可以了。')
  })
  it('★ 名字不能用的那一種不受影響', () => {
    expect(describeExecutionRefusal(1, 'bad_name', '第 1 行：不該出現')).not.toContain('第 1 行')
  })
})
