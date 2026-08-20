/**
 * 護欄：**每一個被宣告需要的能力，至少要有一個目標提供它。**
 *
 * ## 🔴 為什麼需要它
 *
 * spec `142` 讓元件宣告「我只在有某個硬體能力的板子上存在」
 * （`traits.needsCapability`），而目標宣告「我提供哪些能力」（`Target.provides`）。
 *
 * 那開了一個既有護欄**抓不到**的洞：
 *
 * ```
 * 元件宣告 needsCapability = 'touch'
 * 而【沒有任何目標】提供 'touch'
 * → 這顆元件在所有板子上都拿不到，而【可拿性護欄全綠】
 * ```
 *
 * 可拿性算「拿得到」是看**分類定義**（`audit-toolbox-reachability.test.ts:58`
 * 的 `cppCategoryDefs`），與目標無關——所以它看不見這一種不可拿。
 *
 * > **一條護欄看得見什麼，取決於它從哪裡取資料——
 * > 而一個新的維度會在它的視野【外面】製造同一種缺陷。**
 *
 * ## 為什麼是硬性零而不是棘輪
 *
 * 判準（`skills/build-guardrail` 6.8）：**留一筆在那裡，這條規範還成立嗎？**
 * 「元件宣告的能力都有板子提供」——留一筆，就有一顆元件是**任何學生都拿不到**的，
 * 那條規範直接是假的。→ 硬性零。
 *
 * ⚠️ 而第二個問題（修一筆要付多少）答案是**很便宜**：
 * 要嘛某個目標補上那個能力，要嘛那顆元件的宣告寫錯了。兩者都是一行。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果掃到的元件數是 0，代表登錄表沒載入，不是「沒有元件宣告能力」。**
 * 判斷依據是「★ 健康檢查」那一支——它錨在**掃到幾顆元件**（一個不隨修復改變的
 * 輸入量），🔴 **不是錨在違規數**：違規數正是這條護欄要推向零的東西，
 * 拿它當入口條件的話，**成功的那天它就會紅**。
 *
 * ## ⚠️ 第一次跑是【綠】的——而那不是壞掉
 *
 * `build-guardrail` 6.5 要求「第一次跑必須是紅的」，理由是
 * 「那個世界裡一定有東西不合規」。⚠️ **這一條是同一節的例外**：
 *
 * > 「這種情況靠的是注入，不是靠第一次的紅」
 *
 * 護欄在**任何元件宣告能力之前**就蓋好（tasks T001 先於 T006／T007），
 * 所以第一次跑時分子本來就是 0。**它的可信度由下面兩支注入提供。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查能力的名字取得好不好**——`touch` vs `esp32-touch` 是命名判斷
 * - **不檢查一顆元件該不該需要那個能力**——那是領域知識
 * - **不檢查目標宣告的能力有沒有元件在用**（反方向）：一個沒有元件需要的能力
 *   是**無害的**（它只是還沒有消費者），而反過來是**有害的**
 */
import { describe, it, expect } from 'vitest'
import { componentManifests } from '../../src/core/component/registry'
import type { Target } from '../../src/core/types'

/**
 * 產品裡所有的目標——**glob 直讀，不列清單**。
 *
 * ⚠️ 第一版在這裡手寫了四個 import，而它是**雙重真相**（`app.ts` 註冊的是另一份）。
 * 症狀當場出現：spec 142 加了三塊板子之後，護欄仍然回報「有限縮的目標：0/4」
 * ——**它看不到新目標，於是它守的那件事悄悄變成空的**。
 *
 * > **一份要跟著另一份走的清單，遲早會停在它被寫下的那一天。**
 *
 * 🟢 判準與 `component/registry.ts` 的檔頭同一條：
 * **這個東西有沒有人要「查」它？** 沒有（一整批資料）→ glob 直讀。
 */
const TARGET_FILES = import.meta.glob('../../src/languages/cpp/targets/*.json', {
  eager: true,
}) as Record<string, { default: Target }>

function allTargets(): Target[] {
  return Object.values(TARGET_FILES).map((m) => m.default)
}

interface Need { componentId: string; capability: string }

function declaredNeeds(extra: { componentId: string; capability: string }[] = []): Need[] {
  const out: Need[] = extra.map((e) => ({ componentId: e.componentId, capability: e.capability }))
  for (const m of componentManifests()) {
    const t = (m as { traits?: Record<string, unknown> }).traits
    const cap = t?.needsCapability
    if (typeof cap === 'string' && cap !== '') out.push({ componentId: m.componentId, capability: cap })
  }
  return out
}

/**
 * ⚠️ **省略 `provides` ＝ 提供全部**，不是「一個都不提供」。
 * 非硬體目標（cpp／c／競程）不得因為多了這一格就開始少東西。
 */
function suppliedBy(targets: readonly Target[]): (cap: string) => Target[] {
  return (cap) => targets.filter((t) => t.provides === undefined || t.provides.includes(cap))
}

function measure(
  extra: { componentId: string; capability: string }[] = [],
  targets: readonly Target[] = allTargets(),
): { needs: Need[]; orphans: Need[] } {
  const supplies = suppliedBy(targets)
  const needs = declaredNeeds(extra)
  return { needs, orphans: needs.filter((n) => supplies(n.capability).length === 0) }
}

describe('護欄：能力供給完備性', () => {
  // ── ★ 健康檢查：錨在掃到幾顆元件，不在違規數 ────────────────────
  it('★ 健康檢查：掃到的元件數不得為零', () => {
    expect(componentManifests().length, '一顆元件都沒掃到 → 登錄表沒載入，下面的數字是假的')
      .toBeGreaterThan(100)
  })

  it('★ 健康檢查：註冊的目標數不得為零', () => {
    expect(allTargets().length, '一個目標都沒有 → 供給端是空的，任何宣告都會被判成孤兒')
      .toBeGreaterThan(0)
  })

  // ── ★ 注入：兩個方向都釘（見檔頭「第一次跑是綠的」）──────────────
  it('★ 注入：一個沒有任何目標提供的能力 → **必須被報出**', () => {
    // ⚠️ **目標也要是合成的。** 第一版拿真實目標去注入，而它失敗了
    //    ——因為今天四個目標**全部省略 `provides`**（＝提供全部），
    //    於是沒有任何能力可能成為孤兒。那不是護欄壞了，是**輸入讓它成立**。
    //
    // 🔴 而那件事本身要看得見，見下面的「入口條件」那一支。
    const restricted: Target[] = [{ id: 'r', name: 'r', topic: 't', style: 's', provides: ['other'] } as Target]
    const { orphans } = measure([{ componentId: 'test:synthetic', capability: '__nobody_provides__' }], restricted)
    const hit = orphans.find((o) => o.componentId === 'test:synthetic')
    expect(hit, '合成的孤兒能力沒有被報出來 → **護欄壞了，不是供給完整**').toBeDefined()
  })

  it('★ 入口條件：至少要有一個目標**限縮**了能力，否則這條護欄是空的', () => {
    // 🔴 **這一支是這條護欄唯一的健康訊號。**
    //
    // 只要每一個目標都省略 `provides`（＝提供全部），那麼**任何**宣告都不會
    // 成為孤兒——護欄回報「零違規」，而它其實什麼都沒量。
    //
    // > **一條永遠不可能為真的判定，與一條永遠通過的判定，讀起來一模一樣。**
    //
    // ⚠️ 錨在「有沒有目標限縮」（一個**結構**事實），
    //    🔴 不錨在違規數——違規數正是這條護欄要推向零的東西。
    const restricting = allTargets().filter((t) => t.provides !== undefined)
    expect(restricting.length,
      '沒有任何目標宣告 `provides` → 這條護欄的判定恆為真，它什麼都沒在守')
      .toBeGreaterThan(0)
  })

  it('★ 注入：一個有目標提供的能力 → **必須不被報出**', () => {
    // 🔴 第二支不可省：沒有它，一個「什麼都報」的掃描器也能通過上面那支。
    const fake: Target[] = [{ id: 'x', name: 'x', topic: 't', style: 's', provides: ['__provided__'] } as Target]
    const { orphans } = measure([{ componentId: 'test:ok', capability: '__provided__' }], fake)
    expect(orphans.map((o) => o.componentId), '有人提供卻仍被報成孤兒 → 護欄會亂報')
      .not.toContain('test:ok')
  })

  it('★ 注入：省略 `provides` 的目標**提供全部**', () => {
    // ⚠️ 這是 FR-006 的機械化：非硬體目標不得因為多了這一格就開始少東西。
    const bare: Target[] = [{ id: 'y', name: 'y', topic: 't', style: 's' } as Target]
    const { orphans } = measure([{ componentId: 'test:any', capability: '__anything__' }], bare)
    expect(orphans, '省略 provides 被當成「不提供」→ 既有的三個目標會整批壞掉').toEqual([])
  })

  // ── 硬性零 ────────────────────────────────────────────────
  it('🔴 每一個被宣告需要的能力，至少要有一個目標提供它', () => {
    const { needs, orphans } = measure()
    const report = orphans.map((o) => `  ${o.componentId} 需要「${o.capability}」，而沒有任何目標提供它`)
    expect(orphans, `\n宣告了卻沒有板子提供的能力（那顆元件【任何學生都拿不到】）：\n${report.join('\n')}\n`)
      .toEqual([])
    const restricting = allTargets().filter((t) => t.provides !== undefined).length
    console.log(`能力宣告：${needs.length} 筆，孤兒 ${orphans.length} 筆｜有限縮的目標：${restricting}/${allTargets().length}`)
  })
})
