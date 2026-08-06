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
import { describe, it, expect } from 'vitest'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, type BaselineMeta } from '../helpers/guardrail'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'

const RULE = '從實際建構出來的直譯器量測：同一 conceptId 呼叫 register() 超過一次即計入。'

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

const interp = new SemanticInterpreter({ maxSteps: 1 })
const dups = interp.duplicateRegistrations()
const extra = dups.reduce((n, d) => n + d.count - 1, 0)

describe('護欄：執行器重複註冊', () => {
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
    const 新增 = dups.map((d) => d.concept).filter((c) => !b.concepts.includes(c))
    if (dups.length < b.duplicateConcepts) {
      printReport('執行器重複註冊：有改善，可下調基線', [
        `  ✔ 重複概念：${b.duplicateConcepts} → ${dups.length}`,
      ])
    }
    expect(新增, `新增的重複註冊：${新增.join('、')}`).toEqual([])
    expect(dups.length).toBeLessThanOrEqual(b.duplicateConcepts)
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
