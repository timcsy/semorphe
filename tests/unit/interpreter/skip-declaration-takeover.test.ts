/**
 * 宣告接手了核心刪掉的那個空操作（061）
 *
 * ## 為什麼需要這支
 *
 * `cpp_include_local` 曾經同時有兩個東西讓它不執行：
 *
 * 1. 概念檔的宣告 `skipPaths: ['execute'], reason: 'declarative'`（053 建立）
 * 2. 核心直譯器裡一份寫死清單中的空操作（053 **之前**就存在的殘留）
 *
 * 刪掉第 2 個之後，第 1 個必須真的接手。而**兩者的外顯行為完全相同**
 * （都是「什麼都不做地返回」）——所以刪錯了不會有任何測試變紅。
 *
 * 執行器清冊那支會報「掉了一個概念」，但那是**集合比對**，它分不出
 * 「刻意刪除且有宣告接手」與「不小心刪掉了」。這一支補那個縫。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { isSkipped } from '../../../src/core/skip-declarations'
import type { SemanticNode } from '../../../src/core/types'

const n = (concept: string, properties: Record<string, unknown> = {}): SemanticNode =>
  ({ conceptId: concept, properties, children: {} }) as unknown as SemanticNode

beforeAll(() => {
  registerCppLanguage()
})

describe('cpp_include_local：核心的空操作刪了，宣告接手', () => {
  it('★ 宣告存在——沒有它，下面那支會因為「執行器還在」而假通過', () => {
    expect(
      isSkipped('cpp_include_local', 'execute'),
      '概念檔的 skipPaths 宣告不見了。核心的空操作已經刪除，' +
        '兩邊都沒有的話這個概念會變成「未知概念」而中斷使用者的程式。',
    ).toBe(true)
  })

  it('★ 核心不再註冊它的執行器——刪除是刻意的', () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const reg = (interp as unknown as { executorRegistry: { list(): string[] } }).executorRegistry
    expect(
      reg.list().includes('cpp_include_local'),
      '執行器又被註冊回來了。它有宣告，不需要空操作——兩個都在的話，' +
        '哪一個生效取決於註冊順序，而那個順序沒有人設計過。',
    ).toBe(false)
  })

  it('★ 執行它不報錯、不中斷——行為與刪除前完全相同', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    let 未知概念被觸發 = false
    ;(interp as unknown as { unknownConceptHandler?: unknown }).unknownConceptHandler = () => {
      未知概念被觸發 = true
      return 'skip'
    }
    // 宣告接手的話會靜靜返回；沒接手的話會走未知概念那條路
    await interp.executeNode(n('cpp_include_local', { header: 'mine.h' }))
    expect(未知概念被觸發, '宣告沒有接手——這個概念變成了未知概念，會中斷使用者的程式').toBe(false)
  })
})
