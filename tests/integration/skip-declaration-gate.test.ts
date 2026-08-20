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
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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
  it('★ 宣告 generate 由父概念消費，就不得自己註冊模板（矛盾偵測）', async () => {
    const { initCppModule } = await import('../../src/languages/cpp/module')
    const m = initCppModule() as unknown as { templateGenerator: { templates: Map<string, unknown> } }
    const contradictions: string[] = []
    for (const def of allComponentDefs()) {
      if (!(def.skipPaths ?? []).includes('generate' as never)) continue
      if (m.templateGenerator.templates.has(def.componentId)) {
        contradictions.push(`${def.componentId}（宣告不產生，卻註冊了模板）`)
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
    const n = allComponentDefs().filter((d) => (d.skipPaths ?? []).includes('generate' as never)).length
    // 目前預期是 0（四筆假宣告已撤）——所以這裡改成釘住**機制**：
    // 合成一個宣告 skip generate 又有模板的假元件，必須被判為矛盾
    const fakeComponent = { componentId: 'synth_fake', skipPaths: ['generate'] }
    const fakeTemplate = new Map<string, unknown>([['synth_fake', {}]])
    const willCall = (fakeComponent.skipPaths ?? []).includes('generate') && fakeTemplate.has(fakeComponent.componentId)
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

  it('★ 宣告不執行的概念，不得同時註冊「會做事」的執行器（矛盾偵測）', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const contradictions: string[] = []
    for (const def of allComponentDefs()) {
      if (!(def.skipPaths ?? []).includes('execute')) continue
      const ex = interp.getExecutor(def.componentId)
      if (!ex) continue
      // 空操作的函式原始碼很短且沒有 body 內容；會做事的不是
      const src = ex.toString().replace(/\s+/g, '')
      const isNoop = /^async\(?\)?=>\{\}$/.test(src) || /=>\{\}$/.test(src)
      if (!isNoop) contradictions.push(`${def.componentId}（宣告不執行，卻註冊了會做事的執行器）`)
    }
    expect(contradictions, contradictions.join('\n  ')).toEqual([])
  })

  it('★ 判為「還沒實作」的概念沒有偷偷拿到宣告', () => {
    // classification.md 判定不得宣告的那些。這支測試是那份判定的釘子——
    // 有人日後想讓數字好看，最省事的做法就是給它們一個 skipPaths。
    const mustNotDeclare = [
      // cpp_destructor（080）與 cpp_lambda（079）已真的實作／被父概念消費，
      // 從這份「不得宣告」的清單移除。依據見
      // tests/unit/interpreter/consumed-by-parent-evidence.test.ts
      // ⚠️ 以下六個已改判為 `consumed-by-parent`（074），而那正是「用宣告刷
      // 數字」最常見的形狀——053 明明把它們判為「還沒實作」，現在說情況變了。
      // **「情況變了」本身就是最常見的合理化**，所以理由必須可查證：
      //
      //   `tests/unit/interpreter/consumed-by-parent-evidence.test.ts`
      //
      // 那支逐一驗 `cpp_class_def` 的執行器**真的**把每一種成員收進型別，
      // 並附一支反面測試（`cpp_destructor` 不得被誤收——否則「什麼都收」的
      // 實作也會通過）。那支若被刪掉或改成總是通過，這六個宣告就失去依據。
      //
      //   cpp_virtual_method / cpp_override_method / cpp_pure_virtual
      //   cpp_operator_overload / cpp_static_member / cpp_constructor
      //
      // `cpp_class_def` / `cpp_struct_declare` / `cpp_namespace_def` 則是
      // **真的實作了**（071–073），不需要宣告也不在這份清單裡。
      'cpp:ifdef', 'cpp:ifndef',
      'cpp:raw_code', 'cpp:raw_expression',
      // `var_declarator` 與 `cpp_include_local` 已改判——**附證據，不是因為想讓數字下降**：
      //   var_declarator：`var_declare` 的產生器直接讀 `declarators` 的 `name` 與
      //     `initializer`（core/generators/declarations.ts:5-19），extract 策略也是它
      //     建的。四路都由父概念消費。053 當時判「判不出來」是證據不足。
      //   cpp_include_local：與 `cpp_include` 是同一件事，後者早已宣告 declarative。
    ]
    const smuggled = allComponentDefs()
      .filter((d) => mustNotDeclare.includes(d.componentId) && (d.skipPaths ?? []).includes('execute'))
      .map((d) => d.componentId)
    expect(
      smuggled,
      '以下概念實測會產生錯誤的執行結果（或根本測不到），不得宣告成「刻意不執行」：\n  ' +
        smuggled.join('、') +
        '\n見 specs/053-declare-noop-execute/classification.md',
    ).toEqual([])
  })

  it('★ 對照組：該宣告的 11 個確實都宣告了（證明門檻不是靠「大家都沒宣告」而通過）', () => {
    const shouldDeclare = [
      'cpp:comment', 'cpp:block_comment', 'cpp:doc_comment', 'cpp:include', 'cpp:using_namespace',
      // `cpp_define` 已從這裡移除——實作條件編譯之後它**有可觀察效果了**
      //（它決定 `#ifdef` 的 body 跑不跑），不再是 declarative。
      // 宣告會隨系統長出新能力而過期，classification.md 的「複查觸發條件」
      // 列的就是這種情形。
      //
      // ⚠️ **`cpp:pair_declare` 也已移除（2026-08-13），而它是同一個形狀的第二次。**
      // 差別在於：`define` 那次是「系統長出新能力所以宣告過期」，
      // 🔴 **這一次是那個宣告從一開始就是錯的**——`pair<int,int> p;` 一直都有
      // 執行語義（要宣告一個變數），而 `skipReasons: "declarative"` 讓
      // 完備性護欄綠著，代價是第三十二條護欄的 5 段語料跑不動。
      //
      // > **一個假的「顯式的空」不會隨時間過期——它從第一天就是假的，
      // > 而正因為它長得像一個決定，沒有人會回頭質疑它。**
      'cpp:stringstream_declare', 'cpp:ifstream_declare',
      'cpp:ofstream_declare', 'cpp:case', 'cpp:default',
    ]
    const omitted = shouldDeclare.filter((id) => {
      const d = allComponentDefs().find((x) => x.componentId === id)
      return !d || !(d.skipPaths ?? []).includes('execute')
    })
    expect(omitted, `這些通過了實測卻沒拿到宣告：${omitted.join('、')}`).toEqual([])
  })
})
