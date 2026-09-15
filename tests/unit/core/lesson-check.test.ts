/**
 * **裁判：`check` 與逐行比對。**
 *
 * 🔴 這一組守的是「回饋要說得出**哪裡**不一樣」，不是「對或錯」
 * ——整串比只答得出對錯，而**「錯」不是可以行動的資訊**。
 */
import { describe, it, expect } from 'vitest'
import { compareOutput, summarizeComparison, describeLineDiff, parseLesson, taskById, FREE_PRACTICE } from '../../../src/core/lesson/lesson'

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

describe('「排回去」那種題（kind: arrange）', () => {
  const base = { title: 't', pins: {}, components: ['cpp:print'] }

  it('讀得進來', () => {
    const l = parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', kind: 'arrange', check: { stdout: '5\n' } },
    ] })
    expect(l.tasks[0]?.kind).toBe('arrange')
  })

  it('🔴 沒有 check 的「排回去」要丟錯——排完之後沒有人會說話', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', kind: 'arrange' },
    ] })).toThrow(/沒有人會說話/)
  })

  it('認不得的 kind 要丟錯，不要安靜地當成「自己寫」', () => {
    expect(() => parseLesson('x/y', { ...base, tasks: [
      { id: 'a', title: 'A', kind: 'jigsaw', check: { stdout: '1\n' } },
    ] })).toThrow(/kind/)
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

/**
 * **那句翻譯**——老師講了一整個學期的那一句，現在由裁判自己說。
 *
 * 使用者 2026-09-15：「因為之前是輸出四行，所以到這題很常會被判斷多一行，
 * **我都要跟學生說把最後一行拿掉**才會通過」。
 */
describe('summarizeComparison：把「差在哪」講成一句話', () => {
  it('🔴 多印一行 → 說「把最後一行拿掉」', () => {
    const r = compareOutput('3\n3.9\nA\n1\n', '3\n3.9\nA\n')
    expect(r.passed).toBe(false)
    expect(summarizeComparison(r)).toBe('你多印了 1 行——把最後一行拿掉就對了')
  })

  it('多印兩行 → 數字跟著變', () => {
    const r = compareOutput('a\nb\nc\n', 'a\n')
    expect(summarizeComparison(r)).toBe('你多印了 2 行——把最後 2 行拿掉就對了')
  })

  it('少印一行 → 說還差最後一行', () => {
    const r = compareOutput('3\n3.9\n', '3\n3.9\nA\n')
    expect(summarizeComparison(r)).toBe('你少印了 1 行——還差最後一行')
  })

  it('🔴 中間有一行不同 → 不說話（那是錯位，不是多一行）', () => {
    // ⚠️ 講錯的診斷比沒有診斷糟：學生會照著它刪掉不該刪的東西
    const r = compareOutput('3\n9.9\nA\nX\n', '3\n3.9\nA\n')
    expect(summarizeComparison(r)).toBeUndefined()
  })

  it('過了 → 不說話', () => {
    expect(summarizeComparison(compareOutput('a\n', 'a\n'))).toBeUndefined()
  })
})

/**
 * **只差一個空白的時候，要指得出來。**
 *
 * 兩個學生分別逐字說：「一直卡在中間的空格」「就算只是一個空格沒打到都不行」。
 * 而在此之前裁判遇到「行內容不同」**什麼都不說**——畫面上是兩行看起來
 * 一模一樣的東西並排。
 */
describe('describeLineDiff：差在哪一個字', () => {
  it('🔴 少了一個空格（第 4 課那一題的原型）', () => {
    expect(describeLineDiff('你打的是7', '你打的是 7'))
      .toBe('只差在空白——「你打的是」後面少了一個空格')
  })

  it('多了一個空格', () => {
    expect(describeLineDiff('你打的是  7', '你打的是 7'))
      .toBe('只差在空白——「你打的是 」後面多了一個空格')
  })

  it('少了兩個空格 → 數字要對', () => {
    expect(describeLineDiff('a b', 'a   b')).toContain('少了 2 個空格')
  })

  it('空白在最前面', () => {
    expect(describeLineDiff('abc', ' abc')).toBe('只差在空白——最前面少了一個空格')
  })

  it('不是空白的差別 → 指出位置與兩邊各是什麼', () => {
    expect(describeLineDiff('答案是 5', '答案是 6'))
      .toBe('「答案是 」後面開始不一樣：你印的是「5」，要的是「6」')
  })

  it('整段少了一截', () => {
    expect(describeLineDiff('Hello', 'Hello!')).toBe('「Hello」後面少了「!」')
  })

  it('一模一樣 → 不說話', () => {
    expect(describeLineDiff('a', 'a')).toBeUndefined()
  })
})

describe('summarizeComparison：一行不同的時候接上去', () => {
  it('🔴 只有一行差一個空格 → 說得出第幾行、差在哪', () => {
    const r = compareOutput('你打的是7\n', '你打的是 7\n')
    expect(summarizeComparison(r)).toBe('第 1 行只差在空白——「你打的是」後面少了一個空格')
  })

  it('⚠️ 兩行以上不同 → 不說話（指不出「差在哪」）', () => {
    const r = compareOutput('1\n2\n', '3\n4\n')
    expect(summarizeComparison(r), '🔴 一個講錯位置的診斷比沒有診斷糟').toBeUndefined()
  })

  it('行數也不對 → 仍然走行數那一條', () => {
    const r = compareOutput('a\nb\n', 'a\n')
    expect(summarizeComparison(r)).toContain('多印了 1 行')
  })
})
