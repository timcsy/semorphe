import { describe, it, expect } from 'vitest'
import { suggestLessonFor, type LessonScope } from '../../../src/core/lesson-suggest'

const LESSONS: LessonScope[] = [
  { id: 'cpp-beginner/01-印出一句話', components: ['cpp:print', 'cpp:literal_string', 'cpp:endl'] },
  { id: 'cpp-beginner/02-記住資料', components: ['cpp:print', 'cpp:endl', 'cpp:var_declare', 'cpp:var_ref', 'cpp:literal_number', 'cpp:literal_char', 'cpp:comment'] },
  { id: 'cpp-beginner/03-讀進來', components: ['cpp:print', 'cpp:input', 'cpp:var_declare', 'cpp:var_ref'] },
  { id: 'cpp-beginner/09-選擇', components: ['cpp:if', 'cpp:compare', 'cpp:var_ref', 'cpp:print'] },
]

describe('哪一課涵蓋得了這些元件', () => {
  it('🔴 學生的真實情況：釘在第 1 課而在宣告變數 → 指向第 2 課', () => {
    const s = suggestLessonFor(
      ['cpp:var_declare', 'cpp:var_ref', 'cpp:literal_number', 'cpp:literal_char'],
      LESSONS, 'cpp-beginner/01-印出一句話',
    )
    expect(s?.lessonId).toBe('cpp-beginner/02-記住資料')
    expect(s?.covers, '🔴 第 2 課涵蓋得了全部四顆').toBe(4)
    expect(s?.total).toBe(4)
  })

  /** 🔴 **不必跳過頭**——第 3 課也涵蓋得了一部分，而第 2 課是最早的那一堂。 */
  it('🔴 全部涵蓋得了時，回最早的那一堂', () => {
    const s = suggestLessonFor(['cpp:var_declare', 'cpp:var_ref'], LESSONS, 'cpp-beginner/01-印出一句話')
    expect(s?.lessonId).toBe('cpp-beginner/02-記住資料')
  })

  it('★ 只涵蓋得了一部分時，說得出「涵蓋幾顆／共幾顆」', () => {
    const s = suggestLessonFor(['cpp:if', 'cpp:loop_while'], LESSONS, 'cpp-beginner/01-印出一句話')
    expect(s?.lessonId).toBe('cpp-beginner/09-選擇')
    expect(s?.covers).toBe(1)
    expect(s?.total, '🔴 說不出「還差一顆」的建議，會讓學生以為換過去就好了').toBe(2)
  })

  /** 🔴 一堂都不沾邊時**不要硬推一堂**——畫面那一側只端「自由練習」。 */
  it('🔴 沒有一堂沾得上邊 → 不建議', () => {
    expect(suggestLessonFor(['cpp:lambda', 'cpp:template_function'], LESSONS, 'cpp-beginner/01-印出一句話'))
      .toBeNull()
  })

  it('🔴 不建議現在這一課——那是一句廢話', () => {
    const s = suggestLessonFor(['cpp:var_declare'], LESSONS, 'cpp-beginner/02-記住資料')
    expect(s?.lessonId, '🔴 把學生指回他已經在的那一課').not.toBe('cpp-beginner/02-記住資料')
  })

  it('★ 沒有超出範圍的東西 → 不建議', () => {
    expect(suggestLessonFor([], LESSONS, 'cpp-beginner/01-印出一句話')).toBeNull()
  })

  it('★ 順序不影響結果——它自己排', () => {
    const a = suggestLessonFor(['cpp:var_declare'], LESSONS, 'cpp-beginner/01-印出一句話')
    const b = suggestLessonFor(['cpp:var_declare'], [...LESSONS].reverse(), 'cpp-beginner/01-印出一句話')
    expect(a?.lessonId).toBe(b?.lessonId)
  })
})
