/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
/**
 * **第四十二條護欄：每一條診斷規則，在每一個面板、每一種語言都要有文案。**
 *
 * ## 它從哪來
 *
 * 2026-08-14，e2e 抓到程式碼面板顯示給使用者的訊息是
 * **`DIAG_MISSING_CONDITION` 這串原始代號**——因為它查的是
 * `window.Blockly?.Msg`（不存在），而 `?? key` 讓那個失敗**看起來像成功**。
 *
 * > **一個查不到就回傳 key 的降級，會產出一個看起來像訊息的東西
 * > ——而沒有人會回報「訊息怪怪的」，因為畫面上確實有一則訊息。**
 *
 * 而驗收④ 把文案從「每條規則一份」變成「規則 × 面板」兩份，**份數翻倍**
 * ——漏一份的機會也翻倍，而漏的症狀與上面那個一模一樣。
 *
 * ## 自我否證聲明（`build-guardrail` 第 2 步，寫在量測之前）
 *
 * > **如果「掃到的規則身分數」是 0，代表規則表沒讀到（或欄位改名了），
 * > 這條護欄不算數——不是「文案都齊了」。**
 *
 * ⚠️ 錨在**規則身分數**（合成量）上，不錨在缺漏數：缺漏數正是這條要推向零的東西。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測文案寫得好不好**——那是人的判斷
 * - **不檢測兩個面板的文案是否不同**——那是 `tests/unit/ui/diagnostic-message.test.ts`
 *   與 `e2e/diagnostics.spec.ts`（本護欄只管「在不在」）
 * - **不檢測孤兒 key**（有文案而沒有規則用它，例如今天的 `DIAG_EMPTY_BODY`）
 *   ——孤兒是死重量，不是使用者看得到的傷害。⚠️ **刻意不管，不是忘了**
 *
 * ## 硬性零，不是棘輪（第 6.8 步的三個問題）
 *
 * | 問題 | 答案 |
 * |---|---|
 * | 留一筆在那裡，規範還成立嗎 | ❌ **不成立**——缺一份就是一個使用者看到假訊息 |
 * | 修一筆要付多少 | 便宜——寫一行 JSON |
 * | 這個量在別台機器上一樣嗎 | ✅ 一樣——純檔案讀取，沒有外部工具（`history/059` 的第三個問題） |
 */
import { describe, it, expect } from 'vitest'
import { cppDiagnosticRules } from '../../src/languages/cpp/diagnostics'
import { DIAGNOSTIC_CAUSES } from '../../src/core/diagnostics'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'

/** 面板。⚠️ 第三個面板出現時加在這裡，而它的文案缺漏會**自動**變成紅的。 */
const PANELS = ['BLOCK', 'CODE'] as const

const LOCALES: Record<string, Record<string, string>> = {
  'zh-TW': zhTW as Record<string, string>,
  en: en as Record<string, string>,
}

/**
 * 從**規則定義**導出身分，不手寫清單。
 *
 * ⚠️ 手寫的清單會與規則漂移（雙重真相）。而規則**條目**有 4 筆、
 * **身分**只有 3 個（`cpp_if` 與 `cpp_loop_while` 共用 `MISSING_CONDITION`）
 * ——照條目算會多要 2 份不存在的文案。
 */
function ruleIdentities(): string[] {
  return [...new Set([...cppDiagnosticRules.map((r) => r.rule), ...TREE_IDENTITIES])].sort()
}

/**
 * 🔴 **診斷有兩個產出端，而這條護欄原本只看得到一個。**
 *
 * `SYNTAX_ERROR` **不在 `cppDiagnosticRules` 裡**——它不是一條規則，
 * 它是「樹上有 `degradationCause`」這件事的投影（`diagnosticsFromTree`）。
 *
 * > **一條護欄如果只看得到一個產出端，第二個產出端的文案缺漏它就看不到。**
 *
 * ⚠️ 錨在 `DIAGNOSTIC_CAUSES` 上而不是硬寫 `['SYNTAX_ERROR']`：
 * 那個常數是「哪些降級原因走診斷通道」的**唯一來源**，
 * 而它一旦多一種，這裡就會跟著要求新的文案。
 */
const TREE_IDENTITIES: string[] = DIAGNOSTIC_CAUSES.map((c) => c.toUpperCase())

interface Missing {
  rule: string
  panel: string
  locale: string
  key: string
}

/** 缺漏清單。**吃字典而不是直接讀檔**，注入才餵得進來。 */
function missingLabels(
  identities: string[],
  locales: Record<string, Record<string, string>>,
): Missing[] {
  const out: Missing[] = []
  for (const rule of identities) {
    for (const panel of PANELS) {
      const key = `DIAG_${rule}_${panel}`
      for (const [locale, table] of Object.entries(locales)) {
        if (!(key in table)) out.push({ rule, panel, locale, key })
      }
    }
  }
  return out
}

describe('第四十二條護欄：診斷文案在每個面板、每種語言都要有', () => {
  it('★ 入口條件：真的從規則表讀到身分了（錨在身分數，不錨在缺漏數）', () => {
    expect(
      ruleIdentities().length,
      '掃到的規則身分數是 0 → 規則表沒讀到或 `rule` 欄位改名了，這條護欄不算數（見檔頭的自我否證）',
    ).toBeGreaterThan(0)
    // ⚠️ **兩個產出端都要有身分**——只剩一個的話這條護欄只守住一半。
    expect(cppDiagnosticRules.length, '規則表是空的').toBeGreaterThan(0)
    expect(TREE_IDENTITIES.length, '樹產出端一個身分都沒有 → 語法錯誤的文案不會被檢查').toBeGreaterThan(0)
  })

  it('★ 入口條件：兩種語言的文案表都不是空的', () => {
    for (const [locale, table] of Object.entries(LOCALES)) {
      expect(Object.keys(table).length, `${locale} 的文案表是空的 → 這條護欄不算數`).toBeGreaterThan(10)
    }
  })

  it('★ 注入：少一份 → **必須報出來，而且指名是哪條規則／哪個面板／哪種語言**', () => {
    const synthetic = {
      'zh-TW': { DIAG_ZZ_SYNTH_BLOCK: 'a', DIAG_ZZ_SYNTH_CODE: 'b' },
      en: { DIAG_ZZ_SYNTH_BLOCK: 'a' }, // ← CODE 這一份刻意缺
    }
    const missing = missingLabels(['ZZ_SYNTH'], synthetic)
    expect(missing.length, '少了一份卻沒被抓到').toBe(1)
    // ⚠️ **釘住理由，不只釘結果**：報出來還要說得出缺的是哪一份，
    // 否則在 12 份裡「有缺漏」這個結論沒有用。
    expect(missing[0]).toEqual({
      rule: 'ZZ_SYNTH',
      panel: 'CODE',
      locale: 'en',
      key: 'DIAG_ZZ_SYNTH_CODE',
    })
  })

  it('★ 注入（反向）：全都在 → **不得亂報**', () => {
    const synthetic = {
      'zh-TW': { DIAG_ZZ_SYNTH_BLOCK: 'a', DIAG_ZZ_SYNTH_CODE: 'b' },
      en: { DIAG_ZZ_SYNTH_BLOCK: 'a', DIAG_ZZ_SYNTH_CODE: 'b' },
    }
    expect(missingLabels(['ZZ_SYNTH'], synthetic), '沒有缺漏卻報了').toEqual([])
  })

  it('★ 硬性零：真實的規則 × 面板 × 語言，缺漏數必須是 0', () => {
    const missing = missingLabels(ruleIdentities(), LOCALES)
    expect(
      missing.map((m) => `${m.key}  ←  ${m.locale}（規則 ${m.rule}／面板 ${m.panel}）`),
      '缺文案的診斷會顯示成一句 fallback，而使用者看不出那是缺漏——\n' +
        '⚠️ 2026-08-14 之前的症狀更糟：直接把規則代號當訊息顯示，\n' +
        '而畫面上「確實有一則訊息」，所以沒有人回報。\n' +
        '處置：在 `src/i18n/{zh-TW,en}/blocks.json` 補上那一行。',
    ).toEqual([])
  })

  it('★ 通用退路 `DIAG_UNKNOWN` 必須存在——它是執行期唯一不查表的那一句', () => {
    for (const [locale, table] of Object.entries(LOCALES)) {
      expect(
        table.DIAG_UNKNOWN,
        `${locale} 少了 DIAG_UNKNOWN → 文案缺漏時面板會顯示空字串，而空訊息比錯訊息更難查`,
      ).toBeTruthy()
    }
  })
})
