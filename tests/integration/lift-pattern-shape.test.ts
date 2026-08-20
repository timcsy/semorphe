/**
 * spec 157：**讀不懂的 lift 樣式要當場出聲。**
 *
 * ## 這一支怎麼來的
 *
 * spec `156` 加了第一顆 Python 元件，而它的 `lift-pattern.json` 寫著
 * `patternType: "named-call"`——**那不是合法值**。
 *
 * ```
 * 合法值   simple | operatorDispatch | chain | composite | unwrap | contextTransform | multiResult
 * 而它     已經被 componentLiftPatterns() 的 glob 收進生產路徑（61 筆裡有它）
 * ```
 *
 * > **一筆型別不合法的宣告被讀了進去，而讀的人不驗。**
 *
 * ⚠️ 這是這個專案「宣告了而沒有人查它」的第**六**次，而**它比前五次更難發現**：
 * 前幾次是「**沒有人讀**」，這次是「**讀了，而讀的人不驗**」。
 *
 * 🔴 而 `lift-patterns.ts` 的檔頭早就寫著這一課：
 * 「**照抄之前要先問「它是不是同一類」**」——而 spec 156 正是照抄了不同類的形狀。
 *
 * ## ⚠️ 合法值取自型別來源
 *
 * `PATTERN_TYPES`（`core/types.ts`）——**不在這裡抄第二份**。
 * 兩份判準遲早會漂，而漂掉的那天這條護欄會安靜地放行。
 */
import { describe, it, expect } from 'vitest'
import { componentLiftPatterns } from '../../src/core/component/lift-patterns'
import { PATTERN_TYPES } from '../../src/core/types'

interface Loaded {
  id?: string
  patternType?: string
  concept?: { componentId?: string }
  operatorDispatch?: { routes?: Record<string, string> }
}

/**
 * 這一筆樣式**說得出它產生哪個概念**嗎。
 *
 * 🔴 **身分的位置依 `patternType` 而不同**——第一版只問 `concept.componentId`，
 * 於是五筆 `operatorDispatch` 被誤報（它們的身分在 `routes` 的值裡）。
 *
 * > **一個「每一筆都要有 X」的判準，先要問【X 在每一種形狀裡都在同一個地方嗎】。**
 */
function declaredConcepts(p: Loaded): string[] {
  if (p.concept?.componentId) return [p.concept.componentId]
  if (p.patternType === 'operatorDispatch') return Object.values(p.operatorDispatch?.routes ?? {})
  return []
}

const patterns = componentLiftPatterns() as Loaded[]

describe('spec 157 · lift 樣式的形狀', () => {
  it('★ 錨點：真的載到樣式了（否則下面在驗空集合）', () => {
    expect(patterns.length, '一筆樣式都沒載到 → 是 glob 壞了，不是沒有樣式').toBeGreaterThan(20)
  })

  it('🔴 每一筆的 `patternType` 都要在合法集合裡', () => {
    const bad = patterns
      .filter((p) => p.patternType !== undefined && !(PATTERN_TYPES as readonly string[]).includes(p.patternType))
      .map((p) => `${p.id ?? p.concept?.componentId ?? '(無 id)'}：${p.patternType}`)
    expect(bad,
      `不認得的 patternType（合法值：${PATTERN_TYPES.join('｜')}）。`
      + '⚠️ 它會被靜靜忽略——樣式不生效，而學生的程式碼辨識不出來。').toEqual([])
  })

  it('🔴 每一筆都要說得出它產生哪個概念', () => {
    const bad = patterns.filter((p) => declaredConcepts(p).length === 0).map((p) => `${p.id ?? '(無 id)'}(${p.patternType ?? 'simple'})`)
    expect(bad,
      '樣式說不出它產生哪個概念——它 lift 出來的東西沒有身分。'
      + '⚠️ 若這是一種【新的形狀】，要在 `declaredConcepts()` 裡教它去哪裡找，'
      + '**不是放寬判準**。').toEqual([])
  })

  it('★ 反向：合法的樣式不得被誤報', () => {
    // 沒有這一條，一個「什麼都報」的檢查也能通過上面兩支。
    const legal = patterns.filter((p) => p.patternType === undefined || (PATTERN_TYPES as readonly string[]).includes(p.patternType))
    expect(legal.length, '合法的樣式一筆都不剩 → 判準把全部都當成違規了').toBeGreaterThan(20)
  })
})
