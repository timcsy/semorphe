/**
 * `core/lesson` 的判定——**壞掉的宣告要出聲，不要回一堂空的課**。
 *
 * 🔴 為什麼這一條重要：一堂沒有 `components` 的課會讓工具箱變成空的，
 * 而畫面上那與「這堂課就是這麼小」**長得一模一樣**。
 */
import { describe, it, expect } from 'vitest'
import { parseLesson, controlsPinnedBy, lessonIdFromQuery, taskIdFromQuery, editorHref } from '../../../src/core/lesson'

const OK = { title: '印出一句話', pins: { target: 'cpp' }, components: ['cpp:print'] }

describe('parseLesson', () => {
  it('好的宣告讀得出來', () => {
    const l = parseLesson('t/01', OK)
    expect(l.id).toBe('t/01')
    expect(l.title).toBe('印出一句話')
    expect(l.pins.target).toBe('cpp')
    expect(l.components).toEqual(['cpp:print'])
  })

  it('★ 注入：沒有 components → 丟錯（不得回一堂空的課）', () => {
    expect(() => parseLesson('t/01', { ...OK, components: [] })).toThrow(/components/)
    expect(() => parseLesson('t/01', { title: 'x' })).toThrow(/components/)
  })

  it('★ 注入：沒有 title → 丟錯', () => {
    expect(() => parseLesson('t/01', { components: ['a:b'] })).toThrow(/title/)
  })

  it('★ 注入：components 裡有不是字串的東西 → 丟錯', () => {
    expect(() => parseLesson('t/01', { ...OK, components: ['a:b', 7] })).toThrow(/字串/)
  })

  it('★ 注入：pins.target 不是字串 → 丟錯', () => {
    expect(() => parseLesson('t/01', { ...OK, pins: { target: 3 } })).toThrow(/target/)
  })

  it('沒有 pins 是合法的——那代表這堂課不釘目標', () => {
    const l = parseLesson('t/01', { title: 'x', components: ['a:b'] })
    expect(l.pins.target).toBeUndefined()
    expect(controlsPinnedBy(l)).toEqual([])
  })
})

describe('controlsPinnedBy', () => {
  it('🪦 今天不藏任何控制項——使用者用一次就推翻了那個假設', () => {
    // 「我發現選了課程之後目標就不見了」（2026-08-28）
    // 🟢 正解是「換目標就退出課程」，不是把目標藏起來。
    expect(controlsPinnedBy(parseLesson('t/01', OK))).toEqual([])
  })
})

describe('lessonIdFromQuery', () => {
  it.each([
    ['?lesson=a/b', 'a/b'],
    ['?x=1&lesson=a/b&y=2', 'a/b'],
    ['?lesson=%20a/b%20', 'a/b'],
  ])('%s → %s', (q, want) => {
    expect(lessonIdFromQuery(q)).toBe(want)
  })

  it.each(['', '?', '?x=1', '?lesson=', '?lesson=%20'])('%s → null（沒有選課）', (q) => {
    expect(lessonIdFromQuery(q)).toBeNull()
  })
})

/**
 * **課文頁那顆「在編輯器練習」的按鈕靠這一組**（2026-09-12）。
 *
 * 🔴 `editorHref` 與 `lessonIdFromQuery`／`taskIdFromQuery` 是**寫的那一端**
 * 與**讀的那一端**——它們住在同一個檔案的理由就是這幾條：
 * 產生的網址，必須讀得回原來那兩個 id。
 */
describe('taskIdFromQuery', () => {
  it.each([
    ['?lesson=a/b&task=try', 'try'],
    ['?task=ex1', 'ex1'],
    ['?task=%20ex1%20', 'ex1'],
  ])('%s → %s', (q, want) => {
    expect(taskIdFromQuery(q)).toBe(want)
  })

  it.each(['', '?', '?lesson=a/b', '?task=', '?task=%20'])('%s → null（呼叫端退回第一題）', (q) => {
    expect(taskIdFromQuery(q)).toBeNull()
  })
})

describe('editorHref', () => {
  it('沒有題目時只帶課', () => {
    expect(editorHref('a/b')).toBe('/?lesson=a%2Fb')
  })

  it('帶題目時兩格都在', () => {
    expect(editorHref('a/b', 'try')).toBe('/?lesson=a%2Fb&task=try')
  })

  it.each(['', undefined])('題目是 %p ＝ 不帶那一格', (t) => {
    expect(editorHref('a/b', t)).toBe('/?lesson=a%2Fb')
  })

  it.each([
    ['cpp-beginner/13-陣列', 'try'],
    ['cpp-advanced/06-Linked List', 'ex1'],   // 🔴 中文與【空白】都要繞得回來
    ['a/b', '跟著做'],
  ])('往返：%s ＋ %s 寫得出去也讀得回來', (lesson, task) => {
    const href = editorHref(lesson, task)
    const search = href.slice(href.indexOf('?'))
    expect(lessonIdFromQuery(search)).toBe(lesson)
    expect(taskIdFromQuery(search)).toBe(task)
  })
})
