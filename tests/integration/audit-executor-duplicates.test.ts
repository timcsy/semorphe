/**
 * 執行器重複註冊護欄（第七條）
 *
 * 量：有多少概念的執行器被註冊超過一次——**勝負由載入順序決定，而那個順序
 * 不是任何人設計的**。
 *
 * ## 這是 051 的病換一個註冊表重演
 *
 * 051 為**辨識規則**建了歧義護欄（同一段語法有多條規則搶）。**執行器註冊表
 * 至今沒有任何東西在看。** 而它剛剛咬了一次：四個轉型概念各被註冊三次，
 * 最後贏的是空操作，於是 `static_cast<int>(3.9)` 輸出 `void`——程式跑完、
 * 印出東西、而它是錯的。
 *
 * ## 為什麼只量不擋
 *
 * 在註冊時報錯會讓既有的載入順序相依一次炸開。而 `knowledge/history/017`
 * 說得很清楚：**一道會拒絕的檢查，必須同時回答「被拒絕的東西去哪了」**——
 * 這裡的答案目前是「不知道」。所以先讓它可見，逐一消除排在後面。
 *
 * ## 失效樣態
 *
 * ⚠️ 如果這個數字是 **0**，先確認 `duplicateRegistrations()` 真的有在數——
 * 註冊表在本功能之前完全沒有計數，「0」和「沒接上」產出一樣。
 * `★ 注入` 那支才是這條護欄的健康檢查。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, type BaselineMeta , assertRatchet } from '../helpers/guardrail'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'

const RULE = '從實際建構出來的直譯器量測：同一 componentId 呼叫 register() 超過一次即計入。'

const SELF_FALSIFICATION =
  '⚠️ 這個數字若是 0，先確認計數真的有接上——註冊表在本功能之前完全沒有計數，' +
  '「0」與「沒接上」產出一樣。判斷依據是「★ 注入」那支測試，不是這裡的數字。'

const NOT_DETECTED =
  '本護欄**不檢測**：辨識規則的歧義（由第五條護欄涵蓋）、產生器與 extractor 的重複註冊、' +
  '跨模組同名但語義不同的概念。'

interface DupBaseline {
  _meta: BaselineMeta
  duplicateConcepts: number
  totalExtraRegistrations: number
  concepts: string[]
}

/**
 * ⚠️⚠️ **本護欄自 2026-08-06 起量的是一個空的註冊表**，直到 2026-08-10 才發現。
 *
 * 這裡原本是 `new SemanticInterpreter(...)` 之後直接 `duplicateRegistrations()`
 * ——**而語言套件從來沒有被載入**。C++ 的執行器一個都沒註冊，
 * 所以重複註冊當然是 0。基線的 `0 / 0` 因此一直是假的：
 * 真實的數字是 **4**（`cpp:method_call`／`struct_at_member`／`struct_at_ptr`／
 * `template_function` 各被註冊兩次）。
 *
 * **而它有注入測試，注入也一直是綠的。** 注入證明的是
 * 「計數器會數」——它手動 `reg.register()` 兩次再確認被數到。
 * **計數器會數 ≠ 註冊表裡有東西。**
 *
 * > `experience.md`：「把量測的**入口條件**寫成斷言（掃了幾個目錄、
 * > 認得哪幾種寫法、語料幾段），而不是只斷言結果。」
 * > 這一條就是那句話的實例——而它示範了為什麼**注入不能取代入口條件**：
 * > 注入釘住了機制，沒釘住輸入。
 */
let interp: SemanticInterpreter
let dups: ReturnType<SemanticInterpreter['duplicateRegistrations']>
let extra = 0
let registeredConceptCount = 0

beforeAll(async () => {
  await Parser.init({ locateFile: (s2: string) => `${process.cwd()}/public/${s2}` })
  registerCppLanguage()
  interp = new SemanticInterpreter({ maxSteps: 1 })
  dups = interp.duplicateRegistrations()
  extra = dups.reduce((n, d) => n + d.count - 1, 0)
  registeredConceptCount = (interp as unknown as {
    executorRegistry: { list(): string[] }
  }).executorRegistry.list().length
})

describe('護欄：執行器重複註冊', () => {
  it('★ 入口條件：註冊表裡真的有東西（沒有這一支，0 與全瞎長得一樣）', () => {
    // ⚠️ 錨在**註冊了幾個概念**（合成量），不錨在重複數——後者正是這條護欄
    // 要推向零的東西。而這一支正是本護欄缺了四天的那一道：
    // 它的注入證明計數器會數，而**沒有任何東西證明註冊表被填過**。
    expect(registeredConceptCount, '執行器註冊表是空的 → 這條護欄什麼都沒量到，數字一律不可信').toBeGreaterThan(50)
  })

  it('產出可讀報表', () => {
    const lines = [
      SELF_FALSIFICATION,
      NOT_DETECTED,
      '',
      `判定規則：${RULE}`,
      '',
      `重複註冊的概念：${dups.length} 個｜多出來的註冊：${extra} 次`,
      '',
      '**勝出的永遠是最後註冊的那個**，而註冊順序取決於建構式裡的呼叫順序——',
      '沒有任何人刻意設計過那個順序。',
      '',
    ]
    for (const d of dups) lines.push(`  ${d.concept}：註冊 ${d.count} 次`)
    printReport('執行器重複註冊護欄', lines)
    expect(dups.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：故意重複註冊必須被數到（沒有這支，「0」不可信）', () => {
    // 用一個一定不存在的概念名，避免干擾真實量測
    const probe = new SemanticInterpreter({ maxSteps: 1 })
    const reg = (probe as unknown as {
      executorRegistry: { register(c: string, e: () => Promise<void>) : void }
    }).executorRegistry
    reg.register('__probe_dup__', async () => {})
    reg.register('__probe_dup__', async () => {})
    const found = probe.duplicateRegistrations().find((d) => d.concept === '__probe_dup__')
    expect(found, '刻意註冊兩次卻沒被數到 → 計數沒接上，報表的數字一律不可信').toBeDefined()
    expect(found!.count).toBe(2)
  })

  it('★ 注入：只註冊一次的不得被誤報（沒這支，「什麼都報」也能過上一支）', () => {
    const probe = new SemanticInterpreter({ maxSteps: 1 })
    const reg = (probe as unknown as {
      executorRegistry: { register(c: string, e: () => Promise<void>) : void }
    }).executorRegistry
    reg.register('__probe_single__', async () => {})
    expect(probe.duplicateRegistrations().find((d) => d.concept === '__probe_single__')).toBeUndefined()
  })

  it('★ 四個轉型概念不得再出現——它們是本功能修掉的那一批', () => {
    const casts = dups.filter((d) => d.concept.includes('cast'))
    expect(
      casts.map((d) => `${d.concept}×${d.count}`),
      '轉型概念又被重複註冊了——那正是 static_cast 輸出 void 的原因',
    ).toEqual([])
  })

  it('棘輪：不得上升', () => {
    const b = loadBaseline<DupBaseline>('executor-duplicates')
    const added = dups.map((d) => d.concept).filter((c) => !b.concepts.includes(c))
    expect(added, `新增的重複註冊：${added.join('、')}`).toEqual([])
    assertRatchet([['重複註冊的概念', dups.length, b.duplicateConcepts]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-executor-duplicates.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('executor-duplicates', {
    _meta: {
      guard: 'executor-duplicates',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    duplicateConcepts: dups.length,
    totalExtraRegistrations: extra,
    concepts: dups.map((d) => d.concept),
  })
}
