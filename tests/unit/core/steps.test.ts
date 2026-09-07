/**
 * **跑了幾步，而比較才是重點**（2026-09-07）。
 */
import { describe, it, expect } from 'vitest'
import { stepsOf, compareSteps, describeSteps } from '../../../src/core/steps'

const counts = (o: Record<string, number>): Map<string, number> => new Map(Object.entries(o))

describe('跑了幾步', () => {
  it('是每一顆節點次數的總和', () => {
    expect(stepsOf(counts({ a: 1, b: 5, c: 5 }))).toBe(11)
    expect(stepsOf(new Map())).toBe(0)
  })

  /**
   * ⚠️ **不排除骨架**——排掉一批就要有人維護那份清單，
   * 而兩種寫法的骨架是同一份，**比出來的倍數不受它影響**。
   */
  it('★ 骨架也算——而那不影響比值', () => {
    const shell = 4
    const a = stepsOf(counts({ shell: shell, work: 100 }))
    const b = stepsOf(counts({ shell: shell, work: 10 }))
    expect(a).toBe(104)
    expect(b).toBe(14)
    // 🔴 而課文要的是「差得出來」，不是「剛好等於 10 倍」
    expect(a / b).toBeGreaterThan(5)
  })
})

describe('比較', () => {
  it('同一題的兩次跑得出倍數', () => {
    expect(compareSteps({ key: 'L#1', steps: 100 }, { key: 'L#1', steps: 25 })).toBe(0.25)
  })

  it('🔴 不同題之間不比——那個倍數沒有意義', () => {
    expect(compareSteps({ key: 'L#1', steps: 100 }, { key: 'L#2', steps: 25 })).toBeUndefined()
  })

  it('第一次跑沒得比', () => {
    expect(compareSteps(null, { key: 'L#1', steps: 10 })).toBeUndefined()
  })

  it('★ 零步不比——那不是「快了無限倍」，是它根本沒跑', () => {
    expect(compareSteps({ key: 'L#1', steps: 0 }, { key: 'L#1', steps: 10 })).toBeUndefined()
    expect(compareSteps({ key: 'L#1', steps: 10 }, { key: 'L#1', steps: 0 })).toBeUndefined()
  })
})

describe('怎麼說', () => {
  it('沒得比時只說步數', () => {
    expect(describeSteps(1234, undefined)).toBe('這一趟走了 1,234 步')
  })

  it('🔴 慢了很多才說「幾倍」', () => {
    expect(describeSteps(800, 8)).toContain('8.0 倍')
  })

  it('🟢 快了很多說百分比', () => {
    expect(describeSteps(100, 0.125)).toContain('13%')
  })

  /**
   * ⚠️ **差不多就不說**——那是同一種做法的雜訊（多一個 if、少一個變數），
   * 而一句每次都出現的話會讓主控台變成沒有人讀的日誌。
   */
  it('★ 差 25% 以內不提倍數', () => {
    expect(describeSteps(100, 1.1)).toBe('這一趟走了 100 步')
    expect(describeSteps(100, 0.9)).toBe('這一趟走了 100 步')
  })

  /**
   * 🔴 **它說的是任務，不是這個人。**
   * （`draft/課程重新設計` §十一：「說到人就砍掉」）
   */
  it('🔴 文案裡不得出現「你」', () => {
    for (const r of [undefined, 8, 0.125, 1.1]) {
      const line = describeSteps(500, r) ?? ''
      expect(line.includes('你'), `🔴 「${line}」說到了這個人`).toBe(false)
    }
  })
})
