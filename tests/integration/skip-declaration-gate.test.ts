/**
 * 宣告的門檻（US1）
 *
 * ## 為什麼宣告需要門檻
 *
 * 「這個概念刻意不執行」這句宣告會讓兩條護欄的數字同時下降，**而不改變任何
 * 一行執行行為**。所以它是最划算、也最危險的一種修改：
 *
 * > 如果一個概念其實是「還沒實作、只是做成空的」，把它宣告成「刻意不執行」
 * > 就是**把缺陷洗成設計**——而且洗完之後，護欄會替它背書。
 *
 * 實測 34 個候選裡只有 **12 個**站得住（見
 * `specs/053-declare-noop-execute/classification.md`）。天真的做法會宣告 31 個。
 *
 * 這支測試是那個門檻的機械化版本。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { describe, it, expect } from 'vitest'
import { allComponentDefs } from '../helpers/component-scan'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { languageGenerators } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../src/core/types'
import type { PathName } from '../../src/core/types'
import { deriveBlockType } from '../../src/core/component/derive-block-type'

const REASONS = new Set(['declarative', 'consumed-by-parent', 'degradation-target'])

describe('宣告的門檻：說不出理由的不准宣告', () => {
  it('有 skipPaths 就必須有對應的 skipReasons', () => {
    const missingReason: string[] = []
    for (const def of allComponentDefs()) {
      for (const p of def.skipPaths ?? []) {
        if (!def.skipReasons?.[p as PathName]) missingReason.push(`${def.componentId} 的 ${p}`)
      }
    }
    expect(
      missingReason,
      '以下宣告說不出理由——沒有理由的宣告是把缺陷洗成設計：\n  ' + missingReason.join('\n  '),
    ).toEqual([])
  })

  it('理由只能是那兩個值——第三個值是在替「還沒做」找體面的名字', () => {
    const badReason: string[] = []
    for (const def of allComponentDefs()) {
      for (const [p, r] of Object.entries(def.skipReasons ?? {})) {
        if (!REASONS.has(String(r))) badReason.push(`${def.componentId} 的 ${p}：「${r}」`)
      }
    }
    expect(badReason, `不認得的理由：${badReason.join('、')}`).toEqual([])
  })

  /**
   * 第三個理由的門檻**比前兩個更硬**。
   *
   * `history/018`：「理由只有固定幾個值且不得增加——第三個值就是在替
   * 『還沒做』找一個體面的名字。」所以加第三個值的代價是：
   * **它的事實依據要能機械查證**，不能只寫一句話。
   *
   * `degradation-target` 的兩個依據：
   *   ① 真的有概念宣告它為 abstractComponent（否則它不是任何人的降級目標）
   *   ② 不在工具箱裡（使用者拖得到的話，它就該辨識得回來）
   */
  it('★ degradation-target 的兩個事實依據，逐一查證', async () => {
    const defs = allComponentDefs()
    const downgradeTarget = defs.filter((d) =>
      Object.values(d.skipReasons ?? {}).includes('degradation-target' as never),
    )
    const pointedTo = new Set(defs.map((d) => (d as { abstractComponent?: string }).abstractComponent).filter(Boolean))
    const toolbox = readFileSync(join(REPO_ROOT, 'src/languages/cpp/toolbox-categories.ts'), 'utf8')

    const unsupported: string[] = []
    for (const d of downgradeTarget) {
      if (!pointedTo.has(d.componentId)) {
        unsupported.push(`${d.componentId}：沒有任何概念宣告它為 abstractComponent —— 它不是誰的降級目標`)
      }
      // 工具箱排除的形式是 `excludeTypes: ['cpp_xxx']`
      //
      // ⚠️ 這裡原本是**字串手術**：`` `u_${d.componentId.split(':').pop()}` ``。
      // 它壞過一次（命名空間遷移後組出 `u_lang:if_else`），被補了一則註解
      // ——**而註解擋不住第二次**：116 把積木型別改成從身分導出之後，
      // `u_` 這個前綴不再存在，同一行又壞了。
      //
      // > **會漂移的不是那一行，是「用手拼出另一個系統的名字」這件事本身。**
      //
      // 改成呼叫導出規則——那是這個問題今天唯一的正確答案。
      const blockType = deriveBlockType(d.componentId)
      if (!toolbox.includes(`'${blockType}'`)) {
        unsupported.push(`${d.componentId}：沒有在工具箱裡被排除 —— 使用者拖得到的話它就該辨識得回來`)
      }
    }
    expect(
      unsupported,
      '以下 degradation-target 宣告的事實依據站不住：\n  ' + unsupported.join('\n  ') +
        '\n**第三個理由的門檻比前兩個更硬**——它的依據要能機械查證，不能只寫一句話。',
    ).toEqual([])
  })

  it('★ 反面：一個普通概念不得偷用 degradation-target', () => {
    // 沒有這支的話，上面那支對「零個宣告者」也會通過
    const defs = allComponentDefs()
    const pointedTo = new Set(defs.map((d) => (d as { abstractComponent?: string }).abstractComponent).filter(Boolean))
    expect(pointedTo.size, '沒有任何概念宣告 abstractComponent → 上面那支什麼都沒驗到').toBeGreaterThan(5)
  })

  /**
   * **矛盾偵測，其餘四路**（2026-08-07 補）。
   *
   * 既有的矛盾偵測只看 `execute`（宣告不執行卻註冊了會做事的執行器）。
   * 另外四路只憑一句話——而實測抓到四筆假的：
   *
   * `cpp_include`／`cpp_include_local`／`cpp_using_namespace`／`cpp_using_alias`
   * 宣告「generate 由父概念消費」，**而它們各自註冊了模板、也真的自己產出**
   * （有無節點兩次產生，差分證明）。
   *
   * **那個假宣告的來源是一個量測假象**：完備性 harness 靠正則剝掉「看起來像
   * 鷹架」的行，而這幾個概念的產出就是那個形狀 → 被判成殼 → 有人用宣告
   * 把殼消掉。**`history/018` 的「用宣告刷數字」，一字不差。**
   */
  // 🔴 2026-10-31：這一支原本問的是 `cpp/module.ts` 的 `TemplateGenerator`，而產品從不裝它
  //    （`setTemplateGenerator` 在 `src/` 零呼叫）——**它驗的是一條產品不走的路**。
  //    改問產品真正查的那張產生器表（`languageGenerators`，產碼也走它）。
  it('★ 宣告 generate 由父概念消費，就不得自己註冊產生器（矛盾偵測）', async () => {
    registerCppLanguage()
    const generators = languageGenerators('cpp', apcs as unknown as StylePreset)
    expect(generators.size, '🔴 產生器表是空的 → 下面的矛盾偵測什麼都沒驗到').toBeGreaterThan(100)
    const contradictions: string[] = []
    for (const def of allComponentDefs()) {
      if (!(def.skipPaths ?? []).includes('code.render' as never)) continue
      if (generators.has(def.componentId)) {
        contradictions.push(`${def.componentId}（宣告不產生，卻註冊了產生器）`)
      }
    }
    expect(
      contradictions,
      '以下宣告與實作矛盾：\n  ' + contradictions.join('\n  ') +
        '\n**先確認是不是量測假象**——這四筆的來源正是完備性 harness 把它們的產出當成鷹架剝掉了。',
    ).toEqual([])
  })

  it('★ 反面：這條檢查不得對「零個宣告者」也通過', () => {
    // 沒有任何概念宣告 skip generate 的話，上面那支什麼都沒驗到
    const n = allComponentDefs().filter((d) => (d.skipPaths ?? []).includes('code.render' as never)).length
    // 目前預期是 0（四筆假宣告已撤）——所以這裡改成釘住**機制**：
    // 合成一個宣告 skip generate 又有模板的假元件，必須被判為矛盾
    const fakeComponent = { componentId: 'synth_fake', skipPaths: ['code.render'] }
    const fakeTemplate = new Map<string, unknown>([['synth_fake', {}]])
    const willCall = (fakeComponent.skipPaths ?? []).includes('code.render') && fakeTemplate.has(fakeComponent.componentId)
    expect(willCall, '合成的矛盾沒被判出來 → 上面那支是死的').toBe(true)
    expect(n, '真實資料目前應為 0（四筆假宣告已撤）').toBe(0)
  })

  it('沒有 skipPaths 卻寫了 skipReasons —— 孤兒理由', () => {
    const orphans: string[] = []
    for (const def of allComponentDefs()) {
      const declared = new Set(def.skipPaths ?? [])
      for (const p of Object.keys(def.skipReasons ?? {})) {
        if (!declared.has(p as PathName)) orphans.push(`${def.componentId} 的 ${p}`)
      }
    }
    expect(orphans).toEqual([])
  })

})
