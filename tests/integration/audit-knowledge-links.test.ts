/**
 * 護欄：**知識庫的連結、指名、投影要對得上。**
 *
 * ## 🔴 為什麼需要它
 *
 * 這些檢查原本只在人跑 `/knowie-judge` 的時候發生，而**判官每一輪重寫一次掃描器**
 * ——2026-09-26 那一輪掃出七筆，前五筆是掃描器自己的缺陷（見 `tools/knowie-scan.ts` 檔頭）。
 *
 * 而 `knowledge/README.md` 早在 2026-08-19 就寫下了那條教訓，**它是對的而且預測到了這一次**：
 * 缺的不是教訓，是它的**載體**。
 *
 * ⚠️ 而一個「有腳本但沒有人跑」的載體，與沒有載體的差別只有一步：
 *
 * > **一條規範沒有機械化的檢查，它本身就是殼。**
 * >（這句話寫在 `audit-guardrail-count` 旁邊，而它同樣適用於掃描器。）
 *
 * ## ⚠️ 自我否證聲明
 *
 * **任何一項的母體是 0，代表路徑寫錯了，不是那一項乾淨了。**
 * 下面第一支就是錨在這件事上——它不錨在「發現幾筆」（那是本護欄要追蹤的東西，
 * 拿它當入口條件的話，成功的那天就會紅）。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判斷一筆知識好不好**——只問連結與指名指得到東西
 * - **不管 `history/` 的孤兒**：一筆病歷沒有人引用不一定是腐爛，
 *   它被歸到 🟡「要人再判」，**不讓這支護欄紅**
 * - 不管內容有沒有過期（那要人讀，`/knowie-judge` 的工作）
 */
import { describe, it, expect } from 'vitest'
import { scanKnowledge, mechanicalHits, emptyPopulations, formatReport } from '../../tools/knowie-scan'

const results = scanKnowledge(process.cwd())

describe('護欄：知識庫的連結與指名', () => {
  it('★ 健康檢查：每一項的母體都不得為零', () => {
    expect(
      emptyPopulations(results),
      `\n🔴 這些項目的母體是 0 → 路徑寫錯了，不是它乾淨了：\n${emptyPopulations(results).join('、')}\n`,
    ).toEqual([])
  })

  it('★ 健康檢查：連結的母體要有規模（否則掃描根本沒走到檔案）', () => {
    const links = results.find((r) => r.name === '死連結')!
    expect(links.population, '知識庫的 [](path) 少於 500 個 → 掃描沒走到檔案').toBeGreaterThan(500)
  })

  it('🔴 機械確定的發現必須是零', () => {
    const hits = mechanicalHits(results)
    expect(hits, `\n${formatReport(results)}\n`).toEqual([])
  })

  it('報出完整讀數（含 🟡 要人再判的那些）', () => {
    console.log(`\n${formatReport(results)}`)
    expect(results.length).toBeGreaterThan(5)
  })
})
