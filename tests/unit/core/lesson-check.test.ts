/**
 * **裁判：`check` 與逐行比對。**
 *
 * 🔴 這一組守的是「回饋要說得出**哪裡**不一樣」，不是「對或錯」
 * ——整串比只答得出對錯，而**「錯」不是可以行動的資訊**。
 */
import { describe, it, expect } from 'vitest'
import { compareOutput, parseLesson } from '../../../src/core/lesson'

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
    expect(l.check).toEqual({ stdout: 'a\n', stdin: ['1'] })
  })

  it('沒有 check 就是【沒有裁判】，不是空的裁判', () => {
    expect(parseLesson('x/y', base).check).toBeUndefined()
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
    expect(l.check?.stdout).toContain('4 5 6')
  })
})
