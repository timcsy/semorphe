/**
 * **第八十一條護欄**：佈局預設列的是「哪幾層」，不是「哪幾個面板」。
 *
 * ## 它從哪來
 *
 * 路線圖「版面：一套 slot 詞彙，兩個宿主」的活驗收逐字：
 *
 * > 驗收：桌機**佈局預設**（專注／對照／三欄）＋ 可拖分隔線；**不做自由 docking**
 *
 * 而 2026-08-26 已經把「面板在哪裡」換成**面板宣告自己在哪一層**
 * （`history/169`）。佈局預設如果列面板名字，**加一個面板就要改三個預設**
 * ——那正是那一刀要消滅的形狀。
 *
 * > **預設列的是「看見哪幾層」，而哪個面板在那一層是面板自己說的。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果宣告的預設數是 0，代表這支沒有讀到那份宣告，
 * > 這份報表不算數——不是「預設都合規」。**
 *
 * 錨在**宣告了幾個預設**（合成量）。
 * 🔴 **刻意不錨在「有幾個違規」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測畫面**（欄寬、分隔線）——那是 `SplitPane` 的事。
 * - **不檢測「這三個預設夠不夠用」**——那是設計判斷，沒有機械判準。
 * - ⚠️ **不檢測「有沒有人真的用它」**——那要一支 e2e。
 */
import { describe, it, expect } from 'vitest'
import { LAYOUT_PRESETS, layoutPreset } from '../../src/core/host/layout-presets'
import { LAYER_ORDER } from '../../src/core/view-host'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'

describe('第八十一條護欄：佈局預設列的是層，不是面板', () => {
  it('★ 入口條件：真的讀到那份宣告了', () => {
    expect(LAYOUT_PRESETS.length, '一個預設都沒讀到 → 下面的 0 是假的').toBe(3)
    expect(LAYOUT_PRESETS.map((p) => p.id)).toEqual(['focus', 'compare', 'three-column'])
  })

  it('🔴 硬性零：每一層都必須是【宣告過的理解層次】', () => {
    // 一個打錯字的層（`'element '`、`'blocks'`）會讓那一欄永遠是空的，
    // ⚠️ 而症狀是「那個預設少一欄」，不是報錯。
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      for (const l of p.layers) if (!LAYER_ORDER.includes(l)) bad.push(`${p.id} → ${l}`)
    }
    expect(bad, `這些不是宣告過的層：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 硬性零：順序必須是 `LAYER_ORDER` 的【子序列】——不得重排', () => {
    // 🔴 那個順序是**理解的層次**（元素 → 關係 → 空間 → 狀態），不是偏好。
    //    一個把它重排的預設，等於宣稱那個順序可以協商。
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      const idx = p.layers.map((l) => LAYER_ORDER.indexOf(l))
      const sorted = [...idx].sort((a, b) => a - b)
      if (JSON.stringify(idx) !== JSON.stringify(sorted)) bad.push(`${p.id} → ${p.layers.join(',')}`)
    }
    expect(bad, `這些預設把層的順序重排了：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 硬性零：`state` 不得出現在編輯區的預設裡', () => {
    // ⚠️ 狀態層（主控台／變數）的家是**下方的面板區**，三個預設都一樣。
    //    列它進來會讓「面板區」變成一個可以被佈局關掉的東西，
    //    而那與「程式在講話的地方」衝突。
    const bad = LAYOUT_PRESETS.filter((p) => p.layers.includes('state')).map((p) => p.id)
    expect(bad, '狀態層被列進編輯區的預設了').toEqual([])
  })

  it('🔴 硬性零：每一個預設都要有一個【給人看的名字】（兩種語言）', () => {
    // 與第七十八條同一個原則（`principles.md:126`）：**不得把 id 印上畫面**。
    const tables: Array<[string, Record<string, string>]> = [
      ['zh-TW', zhTW as unknown as Record<string, string>],
      ['en', en as unknown as Record<string, string>],
    ]
    const missing: string[] = []
    for (const [loc, t] of tables) {
      for (const p of LAYOUT_PRESETS) if (!t[p.nameKey]) missing.push(`${loc} ${p.nameKey}`)
    }
    expect(missing, `這些預設在畫面上會顯示代號：\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('★ 注入：四個判準各自認得出它要抓的那一種', () => {
    // ⚠️ 上面四條硬性零今天都是綠的（宣告本來就對），
    // 🔴 而 `build-guardrail` §6.5 說「第一次綠沒有一種是好消息」
    //    ——這一支就是那個例外的處置：**用合成的違規證明判準會說話**。
    const fake = [
      { id: 'a', layers: ['blocks'], nameKey: 'X' },           // 不是宣告過的層
      { id: 'b', layers: ['space', 'element'], nameKey: 'X' }, // 順序重排了
      { id: 'c', layers: ['element', 'state'], nameKey: 'X' }, // 狀態層混進來
    ] as unknown as typeof LAYOUT_PRESETS

    const badLayer = fake.flatMap((p) => p.layers.filter((l) => !LAYER_ORDER.includes(l)))
    expect(badLayer, '認不出「不是宣告過的層」').toEqual(['blocks'])

    const reordered = fake.filter((p) => {
      const idx = p.layers.map((l) => LAYER_ORDER.indexOf(l))
      return JSON.stringify(idx) !== JSON.stringify([...idx].sort((x, y) => x - y))
    }).map((p) => p.id)
    expect(reordered, '認不出「順序重排」').toEqual(['b'])

    const withState = fake.filter((p) => p.layers.includes('state')).map((p) => p.id)
    expect(withState, '認不出「狀態層混進編輯區」').toEqual(['c'])

    const noName = fake.filter((p) => !(zhTW as unknown as Record<string, string>)[p.nameKey]).map((p) => p.id)
    expect(noName, '認不出「沒有給人看的名字」').toEqual(['a', 'b', 'c'])
  })

  it('★ 反向：問一個不存在的預設要回 `undefined`——不得回一個「差不多」的', () => {
    // 缺了這一條，一個「找不到就回第一個」的實作也能通過上面幾條，
    // ⚠️ 而那會讓一個打錯的預設**靜靜地變成專注模式**。
    expect(layoutPreset('nope' as never)).toBeUndefined()
    expect(layoutPreset('compare')?.layers).toEqual(['element', 'space'])
  })
})
