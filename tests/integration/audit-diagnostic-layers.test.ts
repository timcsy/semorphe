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

/**
 * 2026-11-05：54 條有第一層的規則裡 24 條有後兩層 → 補了 13 條形態檢查與通用的；子類別（`CELLA_CALL_ARGUMENTS_TOO_FEW`……）
 * 退回上層規則的那兩句也算有（`diagnosticLayers` 的候選鏈就是這樣走的）。剩下的是系統那一側的（invalid、unclassified、other）
 * ——不是學生的錯，硬寫「試試看」會誤導。補了就往下調，不准往上。
 */
const MISSING_CEILING = 3

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
    // 子類別退回上層：`CELLA_X_WHAT` 沒有自己的、而 `CELLA_X` 有 ⟹ 算有（與 diagnosticLayers 的候選鏈一致）
    const covered = (r: string): boolean => Boolean(zh[`DIAG_${r}_WHY`]) || rules.some((base) => base !== r && r.startsWith(`${base}_`) && Boolean(zh[`DIAG_${base}_WHY`]))
    const missing = rules.filter((r) => !covered(r))
    expect(missing.length, `還沒有後兩層的：${missing.join('、')}`).toBeLessThanOrEqual(MISSING_CEILING)
  })
})
