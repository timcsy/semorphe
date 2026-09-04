/**
 * **裁判：`check` 與逐行比對。**
 *
 * 🔴 這一組守的是「回饋要說得出**哪裡**不一樣」，不是「對或錯」
 * ——整串比只答得出對錯，而**「錯」不是可以行動的資訊**。
 */
import { describe, it, expect } from 'vitest'
import { compareOutput, parseLesson, taskById, FREE_PRACTICE } from '../../../src/core/lesson'

describe('compareOutput：逐行比對', () => {
  it('一模一樣 → 過', () => {
    const r = compareOutput('1 2 3\n4 5 6\n', '1 2 3\n4 5 6\n')
    expect(r.passed).toBe(true)
    expect(r.lines.map((l) => l.kind)).toEqual(['same', 'same'])
  })

  it('🔴 少一行 → 說得出【少了哪一行】，而不只是「錯」', () => {
    const r = compareOutput('1 2 3\n', '1 2 3\n4 5 6\n')
    expect(r.passed).toBe(false)
    expect(r.lines.map((l) => l.kind)).toEqual(['same', 'missing'])
    expect(r.lines[1].want).toBe('4 5 6')
  })

  it('多一行 → extra', () => {
    const r = compareOutput('1\n2\n', '1\n')
    expect(r.lines.map((l) => l.kind)).toEqual(['same', 'extra'])
    expect(r.lines[1].got).toBe('2')
  })

  it('內容不同 → different，而且兩邊都留著（要並排給人看）', () => {
    const r = compareOutput('Hello\n', 'Hi\n')
    expect(r.lines[0]).toEqual({ kind: 'different', got: 'Hello', want: 'Hi' })
  })

  // ⚠️ 空白的處置是**設計決定**，不是實作細節——所以它要有測試
  it('行尾空白忽略——`cout << i << " "` 是很常見的寫法', () => {
    expect(compareOutput('1 2 3   \n', '1 2 3\n').passed).toBe(true)
  })

  it('🔴 行首空白【不】忽略——縮排是輸出格式的一部分（印三角形）', () => {
    expect(compareOutput('  *\n', '*\n').passed).toBe(false)
  })

  it('最後有沒有換行不決定對錯', () => {
    expect(compareOutput('Hi', 'Hi\n').passed).toBe(true)
    expect(compareOutput('Hi\n\n\n', 'Hi').passed).toBe(true)
  })

  it('兩邊都空 → 過（一課本來就可能沒有輸出，例如 Arduino）', () => {
    expect(compareOutput('', '').passed).toBe(true)
  })
})

describe('parseLesson：check 要真的進得來', () => {
  // ⚠️ `components` 至少要一顆（`parseLesson` 的既有規矩）
  const base = { title: 't', pins: {}, components: ['cpp:print'] }

  it('🔴 讀得到 check——它在 2026-09-04 之前【被丟掉】', () => {
    const l = parseLesson('x/y', { ...base, check: { stdout: 'a\n', stdin: ['1'] } })
    // 🔴 舊的一課一個 `check` 讀成**第一題**——66 課一個字都不用改
    expect(l.tasks).toEqual([{ id: 'follow', title: '跟著做', check: { stdout: 'a\n', stdin: ['1'] } }])
  })

  it('沒有 check 就是【沒有裁判】，不是空的裁判', () => {
    expect(parseLesson('x/y', base).tasks).toEqual([])
  })

  it('🔴 形狀不對要丟錯——一個永遠說對的裁判比沒有裁判更糟', () => {
    expect(() => parseLesson('x/y', { ...base, check: { stdin: [] } }))
      .toThrow(/check\.stdout/)
    expect(() => parseLesson('x/y', { ...base, check: { stdout: 'a', stdin: [1] } }))
      .toThrow(/check\.stdin/)
  })

  it('★ 66 課的宣告真的餵得進來（形狀沒有漂）', () => {
    const l = parseLesson('cpp-beginner/15-多層迴圈', {
      title: '多層迴圈', pins: { target: 'cpp' }, components: ['cpp:print'],
      check: { stdout: '1 2 3 \n4 5 6 \n', stdin: [] },
    })
    expect(l.tasks[0]?.check?.stdout).toContain('4 5 6')
  })
})

/**
 * 🔴 **一課有好幾題**——而這是 2026-09-04 的那個缺陷的修法。
 *
 * 使用者：「課程應該除了課程題目之外，還會有一些練習題，**這樣去比對結果
 * 不就沒有辦法做練習題了**？」
 */
describe('parseLesson：tasks', () => {
  const base = { title: 't', pins: {}, components: ['cpp:print'] }

  it('★ 一課三題，其中一題沒有裁判——而它仍然是一題', () => {
    const l = parseLesson('x/y', { ...base, tasks: [
      { id: 'follow', title: '跟著做', check: { stdout: 'Hello!\n', stdin: [] } },
      { id: 'ex1', title: '練習 1：印 1 到 5', check: { stdout: '1 2 3 4 5\n' } },
      { id: 'ex2', title: '練習 2：改用 while 寫' },
    ] })
    expect(l.tasks.map((t) => t.id)).toEqual(['follow', 'ex1', 'ex2'])
    // 🔴 沒有 check 的題目**不是**被丟掉，也**不是**永遠算對
    expect(l.tasks[2]?.check).toBeUndefined()
    // ⚠️ 省略的 stdin 是空陣列，不是 undefined
    expect(l.tasks[1]?.check?.stdin).toEqual([])
  })

  it('🔴 id 重複要當場丟錯——不然通過紀錄會把兩題當成同一題', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'ex1', title: 'A' }, { id: 'ex1', title: 'B' },
    ] })).toThrow(/重複的 id/)
  })

  it('🔴 id 不得是空字串——那是「純練習」那一格的值', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [{ id: '', title: 'A' }] }))
      .toThrow(/純練習/)
  })

  it('形狀不對要丟錯，不要回一個空的題目', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: {} })).toThrow(/不是陣列/)
    expect(() => parseLesson('x/y', { ...base, tasks: [{ title: 'A' }] })).toThrow(/缺 id/)
    expect(() => parseLesson('x/y', { ...base, tasks: [{ id: 'a' }] })).toThrow(/缺 title/)
    // ⚠️ 每一題的裁判走**同一支** `parseCheck`——錯誤訊息要說得出是哪一題
    expect(() => parseLesson('x/y', { ...base, tasks: [{ id: 'a', title: 'A', check: {} }] }))
      .toThrow(/x\/y#a/)
  })

  it('★ tasks 在的時候，舊的 check 讓位——不會多出一題', () => {
    const l = parseLesson('x/y', {
      ...base,
      check: { stdout: '舊的\n', stdin: [] },
      tasks: [{ id: 'only', title: '唯一', check: { stdout: '新的\n' } }],
    })
    expect(l.tasks).toHaveLength(1)
    expect(l.tasks[0]?.check?.stdout).toBe('新的\n')
  })
})

describe('taskById', () => {
  const l = parseLesson('x/y', {
    title: 't', pins: {}, components: ['cpp:print'],
    tasks: [{ id: 'ex1', title: '練習 1' }],
  })

  it('查得到', () => { expect(taskById(l, 'ex1')?.title).toBe('練習 1') })

  it('🔴 純練習回 undefined——而那【不是】缺陷，是那一格的正常值', () => {
    expect(taskById(l, FREE_PRACTICE)).toBeUndefined()
  })

  it('沒有課、或查不到的 id → undefined', () => {
    expect(taskById(undefined, 'ex1')).toBeUndefined()
    expect(taskById(l, '不存在')).toBeUndefined()
  })
})
