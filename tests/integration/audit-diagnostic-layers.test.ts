/**
 * **棘輪：錯誤訊息的三層**（使用者 2026-11-05 定：第一層一句話，點開看「為什麼／試試看」）
 *
 * 每一條有第一層（`DIAG_<規則>_BLOCK`）的規則，最好也有 `_WHY` 與 `_TRY`。今天先補了學生最常碰到的 24 種；
 * 其餘的（多半是系統那一側的：invalid、unclassified……）還沒有。這支數「有第一層而沒有後兩層」的規則——**只准下降**；
 * 而一旦寫了，兩種語系都要有、兩層都要有（半套是硬性零）。
 */
import { describe, it, expect } from 'vitest'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'

/** 2026-11-05：54 條有第一層的規則裡 24 條有後兩層。補了就往下調，不准往上。 */
const MISSING_CEILING = 30

const zh = zhTW as Record<string, string>
const enT = en as Record<string, string>
const rules = [...new Set(Object.keys(zh).filter((k) => /^DIAG_.+_BLOCK$/.test(k)).map((k) => k.slice(5, -'_BLOCK'.length)))]

describe('棘輪：錯誤訊息的三層', () => {
  it('入口條件：掃到的規則數（合成量）', () => {
    expect(rules.length).toBeGreaterThanOrEqual(50)
  })

  it('🔴 硬性零：寫了就要完整——兩種語系、為什麼與試試看兩層都在', () => {
    const half = Object.keys(zh).concat(Object.keys(enT)).filter((k) => /_(WHY|TRY)$/.test(k) && k.startsWith('DIAG_') && !k.startsWith('DIAG_LAYER_'))
      .map((k) => k.replace(/_(WHY|TRY)$/, ''))
      .filter((base, i, all) => all.indexOf(base) === i)
      .filter((base) => !zh[`${base}_WHY`] || !zh[`${base}_TRY`] || !enT[`${base}_WHY`] || !enT[`${base}_TRY`])
    expect(half).toEqual([])
  })

  it('📉 棘輪：有第一層而沒有後兩層的規則，只准下降', () => {
    const missing = rules.filter((r) => !zh[`DIAG_${r}_WHY`])
    expect(missing.length, `還沒有後兩層的：${missing.join('、')}`).toBeLessThanOrEqual(MISSING_CEILING)
  })
})
