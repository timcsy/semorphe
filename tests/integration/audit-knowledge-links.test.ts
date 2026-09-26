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
import {
  scanKnowledge, mechanicalHits, emptyPopulations, formatReport,
  isCachedLessonLine, makeResolver,
} from '../../tools/knowie-scan'
import { join } from 'node:path'

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

  // ── ★ 注入：快取那兩項第一次跑是【綠】的，所以錨只能是合成輸入 ──────
  //
  // 8 條臟行在蓋這一項之前就被寫回 `experience.md` 了。`build-guardrail` 6.5 的例外
  // 逐字：「它第一次跑是綠的，因為那八次都已經被修掉了——這種情況靠的是注入，
  // 不是靠第一次的紅。」
  it('★ 注入：一個蒸餾引言區塊必須被判成「被快取的教訓」', () => {
    expect(isCachedLessonLine('> **一句合成的教訓，它不存在於任何地方。**'),
      '判準認不出引言區塊 → 那一項是假綠').toBe(true)
  })

  it('★ 注入：正常的散文與操作句不得被誤判成快取', () => {
    for (const ok of [
      '⚠️ **這一列的範圍**：改了 X 就跑 Y。',
      '> 一段沒有加粗的引用（例如逐字引使用者的話）',
      '| 🔴 **改了積木的畫法** | 重產對照圖 | 六分鐘 |',
      '🟢 **處方**：先問那一段的答案有沒有被標準定死。',
    ]) {
      expect(isCachedLessonLine(ok), `誤判成快取：${ok}`).toBe(false)
    }
  })

  it('★ 注入：一個指不到東西的指名必須被報出，而真的指名不得被誤報', () => {
    const resolves = makeResolver(join(process.cwd(), 'knowledge'))
    // 合成的名字——刻意不用任何真實的教訓標題（錨在合成輸入上）
    expect(resolves('這個名字刻意不存在於這個知識庫的任何一個檔或標題裡'),
      '解析器把一個不存在的名字判成解析得到 → 失效機制是假的').toBe(false)
    // 而三個命名空間各驗一個「一定在」的東西
    expect(resolves('經驗'), '三個入口檔的指名解析不到').toBe(true)
    expect(resolves('build-guardrail'), 'skills 的指名解析不到').toBe(true)
    expect(resolves('history/001'), 'NNN 前綴形的指名解析不到').toBe(true)
  })

  it('報出完整讀數（含 🟡 要人再判的那些）', () => {
    console.log(`\n${formatReport(results)}`)
    expect(results.length).toBeGreaterThan(5)
  })
})
