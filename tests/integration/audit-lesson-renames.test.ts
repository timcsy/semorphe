/**
 * 414 · **課改過名，舊名字三處都接得住**（2026-11-12）。
 *
 * 表在 `lessons/renamed.json`。課的 id 就是資料夾名，而它出現在學生手上留得住的三個地方：
 * 課文頁的網址、編輯器的深連結（`?lesson=`）、瀏覽器裡的進度。
 *
 * ## ⚠️ 自我否證聲明
 *
 * 表是空的、或新名字根本不是一堂課的話，下面的「舊名字轉得過去」會空過或轉到 404
 * ——所以先釘「表裡有東西、每個新名字都是真的課」。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { LESSON_RENAMES, canonicalLessonId, lessonIdFromQuery, lessonDocHref } from '../../src/core/lesson/lesson'
import { setProgressStore, isTaskPassed, passedTasks } from '../../src/core/lesson/progress'
import { MemoryKeyValueStore } from '../../src/core/host/key-value-store'
import { renderRedirect } from '../../tools/build-lessons/render'

const ROOT = path.resolve(__dirname, '../..')
const isLesson = (id: string): boolean => fs.existsSync(path.join(ROOT, 'lessons', id, 'lesson.json'))
const entries = Object.entries(LESSON_RENAMES)

describe('414 · 改過名的課', () => {
  it('★ 錨點：表裡有東西', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('🔴 每一個新名字都是真的課', () => {
    expect(entries.filter(([, n]) => !isLesson(n)).map(([, n]) => n)).toEqual([])
  })

  it('🔴 每一個舊名字都不再是課——否則兩堂課搶同一個網址', () => {
    expect(entries.filter(([o]) => fs.existsSync(path.join(ROOT, 'lessons', o))).map(([o]) => o)).toEqual([])
  })

  it('🔴 不連鎖：新名字不會又是另一筆的舊名字（一次查表就到）', () => {
    expect(entries.filter(([, n]) => n in LESSON_RENAMES)).toEqual([])
  })

  it('🔴 資料夾名與課名一字不差（使用者 11-11 23:43 選的那條）', () => {
    for (const [, n] of entries) {
      const title = (JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons', n, 'lesson.json'), 'utf8')) as { title: string }).title
      expect(n.split('/')[1].replace(/^\d+-/, ''), n).toBe(title)
    }
  })

  it('🔴 編輯器深連結：舊的 ?lesson= 讀成新 id；沒改名的原樣', () => {
    for (const [o, n] of entries) {
      expect(lessonIdFromQuery(`?lesson=${encodeURIComponent(o)}`)).toBe(n)
    }
    expect(canonicalLessonId('cpp-beginner/13-陣列')).toBe('cpp-beginner/13-陣列')
  })

  it('🔴 進度：舊鍵打過的勾搬到新鍵，與新鍵已有的合併', () => {
    const [o, n] = entries[0]
    const store = new MemoryKeyValueStore()
    store.write('semorphe-progress', JSON.stringify({ [o]: ['try', 'a'], [n]: ['a', 'b'] }))
    setProgressStore(store)
    try {
      expect([...passedTasks(n)].sort()).toEqual(['a', 'b', 'try'])
      expect(isTaskPassed(n, 'try')).toBe(true)
    } finally {
      setProgressStore(new MemoryKeyValueStore())
    }
  })

  it('🔴 課文頁：舊路徑的轉址頁指向新網址，帶著原本的查詢字串', () => {
    const [, n] = entries[0]
    const html = renderRedirect(n)
    const href = lessonDocHref(n)
    expect(html).toContain(`location.replace(${JSON.stringify(href)} + location.search + location.hash)`)
    expect(html).toContain(`<link rel="canonical" href="https://semorphe.com${href}">`)
    expect(html).toContain('http-equiv="refresh"')
  })
})
