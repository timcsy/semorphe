
/**
 * 章節選單的標籤＝資料夾的章節編號 ＋ 課文的標題（2026-11-05 使用者抓到：第 10 課顯示「10-while迴圈」，課文標題是「重複」；2026-11-10 使用者把第 10 課標題也改成「while迴圈」，這裡的「重複」只是一個與資料夾不同的例子）。
 * 資料夾名是課程的身分（存檔、連結、e2e、對照圖都認它），不改；只改顯示。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { chapterLabel } from '../../../src/core/lesson/chapter-label'

describe('章節選單的標籤', () => {
  it('★ 顯示課文的標題，不是資料夾名（標題與資料夾不同時才分得出來）', () => {
    expect(chapterLabel('cpp-beginner/10-while迴圈', '重複')).toBe('10-重複')
  })
  it('沒有編號就只用標題；沒有標題才退回資料夾名', () => {
    expect(chapterLabel('x/intro', '開場')).toBe('開場')
    expect(chapterLabel('x/03-abc', '')).toBe('03-abc')
  })
  it('🔴 每一課的標籤都等於「編號-課文標題」（不再拿資料夾名當名字）', () => {
    const root = path.resolve(__dirname, '../../../lessons')
    const bad: string[] = []
    for (const track of readdirSync(root)) {
      const dir = path.join(root, track)
      if (!statSync(dir).isDirectory()) continue
      for (const l of readdirSync(dir)) {
        const f = path.join(dir, l, 'lesson.json')
        if (!existsSync(f)) continue
        const title = JSON.parse(readFileSync(f, 'utf8')).title as string
        const label = chapterLabel(`${track}/${l}`, title)
        if (!label.endsWith(title)) bad.push(`${track}/${l}：${label}`)
      }
    }
    expect(bad).toEqual([])
  })
})
