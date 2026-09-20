/**
 * **這個主題有哪些積木**——一張平的清單。
 *
 * ## 🪦 它取代了 `level-tree.test.ts`（2026-09-20）
 *
 * 那個檔有 15 條，全部在測「一棵層級樹 ＋ 一個已啟用分支的集合 → 可見集合」。
 * 使用者（2026-09-20）：「我們現在已經有課程了，應該就沒有需要再用 levelTree 了吧」
 * ——而那一層確實是多餘的：`ui/app.ts` 裡**每一個**呼叫點傳的都是「全開」，
 * 註解逐字寫著「收窄由**課**來做，不由層級做」。
 *
 * > **一個從來沒有被用來收窄過的收窄機制，它測的是自己。**
 *
 * ⚠️ 而「這個主題有哪些積木」**不是**多餘的——它今天是唯一擋住
 * 「C 目標拿得到 `vector`／`class`／`cout`」的東西（`Target.provides` 逐字「本輪沒做」）。
 */
import { describe, it, expect } from 'vitest'
import { topicComponents, isComponentInTopic } from '../../../src/core/lesson/topic-components'
import cppBeginner from '../../../src/languages/cpp/topics/cpp-beginner.json'
import cAdvanced from '../../../src/languages/cpp/topics/cpp-advanced.json'
import cBeginner from '../../../src/languages/cpp/topics/c-beginner.json'
import type { Topic } from '../../../src/core/types'

const asTopic = (t: unknown): Topic => t as Topic

describe('topicComponents', () => {
  it('★ 入口條件：三份清單都讀得到東西（否則下面在驗空氣）', () => {
    expect(topicComponents(asTopic(cppBeginner)).size).toBeGreaterThan(100)
    expect(topicComponents(asTopic(cAdvanced)).size).toBeGreaterThan(100)
    expect(topicComponents(asTopic(cBeginner)).size).toBeGreaterThan(50)
  })

  it('回的是一個集合，而它就是宣告的那一份', () => {
    const t = asTopic({ id: 'x', language: 'cpp', name: 'x', components: ['a', 'b', 'a'] })
    expect([...topicComponents(t)].sort()).toEqual(['a', 'b'])
  })

  it('空清單回空集合——而不是丟錯', () => {
    expect(topicComponents(asTopic({ id: 'x', language: 'cpp', name: 'x', components: [] })).size).toBe(0)
  })

  it('isComponentInTopic 答得出在與不在', () => {
    const t = asTopic(cppBeginner)
    expect(isComponentInTopic('cpp:print', t)).toBe(true)
    expect(isComponentInTopic('cpp:這顆不存在', t)).toBe(false)
  })

  /**
   * 🔴 **C 的清單比 C++ 小，而那是這張清單存在的理由。**
   * 少了這一條，「把 levelTree 換成一張平的清單」看起來就只是搬家。
   */
  it('🔴 C 的世界比 C++ 小——`vector`／`class` 不在 C 的清單裡', () => {
    const c = topicComponents(asTopic(cBeginner))
    const cpp = topicComponents(asTopic(cppBeginner))
    expect(c.size, '★ 正向錨點：C 真的比較小').toBeLessThan(cpp.size)
    for (const id of ['cpp:vector_declare', 'cpp:class_def', 'cpp:string_declare']) {
      expect(c.has(id), `🔴 C 的清單裡不該有 ${id}`).toBe(false)
    }
    expect(c.has('cpp:var_declare'), '★ 而基本的東西要在').toBe(true)
  })
})
