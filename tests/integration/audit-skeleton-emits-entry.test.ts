/**
 * **第九十七條護欄**：宣告了進入點的骨架，在**空程式**上必須把那幾顆函式產出來。
 *
 * ## 它從哪來
 *
 * 2026-08-31 使用者：「**我選了 Arduino 骨架，但是是空的**」。
 *
 * 量出來的根因，是骨架的兩半只做了一半：
 *
 * ```
 * entryFunctions  樹裡【哪一塊】是骨架   → Arduino 有兩顆（setup／loop）  ✅ 有填
 * entryPoint      骨架【印出來】長怎樣   → Arduino 是【空陣列】           ❌ 沒填
 * ```
 *
 * 而補丁器的閘門逐字是 `if (entry.length > 0 && …)`（`auto-include.ts`）
 * ——`entryPoint` 空就一個字都不補。於是在「產出」這一維上，
 * **`arduino.json` 與 `none.json` 逐欄相同**：選了骨架，得到的是「沒有骨架」。
 *
 * 🔴 而那個「空」不是決定，是**裝不下**。`arduino.json` 的 `_why` 自己說：
 *
 * > 「而它逼出了 `entryFunctions`：Arduino 有【兩個】進入點。
 * >  原本那個寫死不只是名字錯，**數量也錯**。」
 *
 * 而 schema 的形狀是 `preamble → entryPoint → 【使用者的程式】 → epilogue`
 * ——**一個**進入點包住**一個**本體。兩個函式表達不出來，於是三段被留空，
 * 然後用一句註解把它說成設計。
 *
 * > **一個裝不下的形狀，最常見的偽裝是一句解釋它為什麼該是空的註解。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果註冊到的骨架少於 2 份、或宣告了進入點的少於 1 份，代表語言套件
 * > 沒載入——這份報表不算數，不是「骨架都產得出來」。**
 *
 * ⚠️ 錨在**註冊了幾份骨架**（合成量），**不是**錨在「產不出來的還剩幾份」
 * ——後者會在這條護欄成功的那天變紅。
 *
 * ## 為什麼是硬性零
 *
 * - 「留一筆規範還成立嗎？」——「選了骨架就要看得到骨架」留一筆，那句話就是假的。
 * - 「修一筆要付多少？」——改一份 JSON 宣告。**不會改變任何既有程式的行為。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測簽章對不對**（`void setup()` vs `int setup()`）——只檢測那個名字出現了。
 * - **不檢測非空程式**——那時函式已經在樹裡，走的是別條路（`entryFunctions` 的辨識那半）。
 * - **不檢測積木視圖**——這條只問「程式碼視圖上看不看得到骨架」。
 */
import { describe, it, expect } from 'vitest'
import { allSkeletons, skeletonById } from '../../src/core/skeleton'
import { createCppCodePatcher } from '../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import '../../src/core/load-language-packs'

/** 一棵**空的**程式樹——使用者剛開檔案時的樣子。 */
const emptyProgram = () => ({
  id: 'root', componentId: 'cpp:program', properties: {}, children: { body: [] },
})

/** 空程式在這份骨架下產出的程式碼（`cogLevel: 0` ＝ 補丁器負責進入點）。 */
function emitForEmptyProgram(skeletonId: string): string {
  const patch = createCppCodePatcher(createPopulatedRegistry())
  return patch('', emptyProgram() as never, 'using', 0, skeletonId) ?? ''
}

describe('第九十七條護欄：宣告了進入點的骨架，空程式上要產得出來', () => {
  const skeletons = [...allSkeletons().values()]
  const withEntry = skeletons.filter((s) => s.entryFunctions.length > 0)

  it('★ 入口條件——語言套件真的載入了', () => {
    // 錨在合成量（註冊了幾份），見檔頭的自我否證聲明。
    // 🔴 這兩個數字【不會】因為缺陷被修好而變小。
    expect(
      skeletons.length,
      `🔴 只註冊到 ${skeletons.length} 份骨架 → 語言套件沒載入，這份報表不算數。` +
        '⚠️ 這【不】代表骨架都產得出來。',
    ).toBeGreaterThan(1)
    expect(
      withEntry.length,
      `🔴 沒有任何骨架宣告 entryFunctions → 這條護欄沒有東西可量`,
    ).toBeGreaterThan(0)
  })

  it('★ 注入（不亂報）：沒有宣告進入點的骨架，本來就不該產出東西', () => {
    // 沒有這一支的話，一個「什麼都要求」的檢查會把 `none` 也判成違規
    const none = skeletonById('none')
    expect(none?.entryFunctions.length, '前提：none 宣告零個進入點').toBe(0)
    expect(emitForEmptyProgram('none'), '🔴 沒有進入點的骨架不該補出東西').toBe('')
  })

  it('★ 注入（會報）：把一顆進入點的名字換掉，就必須抓不到', () => {
    // ⚠️ 合成名字，不是真實骨架——真實骨架會被修好，而合成規則不會
    const emitted = emitForEmptyProgram('main')
    expect(emitted.includes('__一個不存在的進入點__'), '🔴 判準會誤判「有」').toBe(false)
  })

  it('🔴 硬性零：每一顆宣告了的進入點，都要出現在空程式的產出裡', () => {
    const missing: string[] = []
    for (const s of withEntry) {
      const emitted = emitForEmptyProgram(s.id)
      for (const f of s.entryFunctions) {
        if (!emitted.includes(f.name)) missing.push(`${s.id} → ${f.name}`)
      }
    }
    if (missing.length) {
      console.log('\n🔴 宣告了卻產不出來的進入點：')
      for (const m of missing) console.log(`   ${m}`)
      for (const s of withEntry) {
        console.log(`\n── ${s.id}（entryFunctions: ${s.entryFunctions.map(f => f.name).join('／')}）`)
        console.log(JSON.stringify(emitForEmptyProgram(s.id)))
      }
    }
    expect(
      missing,
      '🔴 有骨架宣告了進入點卻產不出來——使用者選了它，畫面是空的。' +
        '留一筆，「選了骨架就看得到骨架」這句話就是假的，所以這一條是硬性零。',
    ).toEqual([])
  })
})
