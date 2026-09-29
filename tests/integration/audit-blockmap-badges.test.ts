/**
 * 護欄：**對照圖的號碼，要指得到東西。**
 *
 * ## 🔴 它從哪來（2026-09-29，使用者帶學生上課時發現的）
 *
 * > 「上面 cmath 的積木好像放錯地方。」
 *
 * 量出來：
 *
 * ```
 * cpp-beginner/06 step5   片段 4 行,badge [1,2,4] —— 2 是【空行】,第 3 行的 cout 沒有積木
 * arduino/13-溫濕度        程式 14 行,而 badge 編到 15    ← 超出行數
 * arduino/12-液晶顯示       程式 10 行,而 badge 編到 11
 * python-bridge/06        空行在 3、6、10、13,badge 落在空行 10
 * ```
 *
 * ## 🔴 為什麼既有那兩條看不到它
 *
 * `audit-lesson-blockmaps` 與 `audit-step-blockmaps` 比的是 `engineHash`／`codeHash`
 * ——它們問的是「**這張圖過期了沒**」。
 *
 * > **一份產物有兩個獨立的正確性：它是不是最新的，與它指的位置對不對。
 * > 只錨住前者的檢查，會在後者壞掉時保持全綠。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果掃到的圖數是 0，代表路徑寫錯了，不是號碼都對了。**
 * 錨在**掃到幾張圖**（輸入量）上——刻意不錨在「還有幾個壞號碼」，
 * 那是這條護欄要推向零的東西，拿它當入口條件的話成功的那天就會紅。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查號碼指的那一顆是不是「最合適」的積木**（跨度最小、最靠外那個判準）
 *   ——那要人看圖。這裡只問**指得到東西**。
 * - **不檢查圖該不該存在**：一段反例被畫成「跟著做」的積木圖是另一件事
 *   （母體判錯，2026-09-29 同一次回報的第二件），不在這一條的範圍。
 * - 不檢查 `svg` 畫得好不好。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../assets/blockmaps')

interface Map {
  file: string
  code: string
  badgeLines: number[]
  blocks: { startLine: number; endLine: number }[]
}

function allMaps(): Map[] {
  const out: Map[] = []
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!e.name.endsWith('.json')) continue
      // ⚠️ `_` 開頭的是**記錄檔不是對照圖**（`_skipped.json` 記哪些片段被跳過與原因）。
      //    第一次跑就把它誤報成「沒有 code 欄」——而它本來就沒有。
      //
      // > **一個判準掃一個目錄時，先問那個目錄裡是不是只住著一種東西。**
      if (e.name.startsWith('_')) continue
      const j = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<Map>
      // 🔴 沒有 `code` 欄的那些**要出聲**——實測有 1 張（2026-09-29）。
      //    它進不了下面的判準，而「進不去」與「通過」在讀數上長得一樣。
      if (typeof j.code !== 'string') { out.push({ file: path.relative(DIR, p), code: '', badgeLines: [], blocks: [] }); continue }
      out.push({
        file: path.relative(DIR, p),
        code: j.code,
        badgeLines: j.badgeLines ?? [],
        blocks: j.blocks ?? [],
      })
    }
  }
  walk(DIR)
  return out
}

const maps = allMaps()

describe('護欄：對照圖的號碼要指得到東西', () => {
  it('★ 入口條件：掃到的對照圖不得為零', () => {
    expect(maps.length, '🔴 一張對照圖都沒掃到 → 路徑寫錯了，下面的零是假的').toBeGreaterThan(100)
  })

  it('★ 入口條件：每一張都要有 code 欄（沒有的進不了判準）', () => {
    const missing = maps.filter((m) => m.code === '').map((m) => m.file)
    expect(missing, `\n🔴 這些圖沒有 code 欄，下面三條判準對它們一句話都沒說：\n${missing.join('\n')}\n`)
      .toEqual([])
  })

  it('🔴 硬性零：號碼不得超出那段程式碼的行數', () => {
    const bad: string[] = []
    for (const m of maps) {
      const n = m.code.split('\n').length
      for (const b of m.badgeLines) if (b > n || b < 1) bad.push(`${m.file}  號碼 ${b}，而程式只有 ${n} 行`)
    }
    expect(bad, `\n🔴 號碼指到不存在的行：\n${bad.join('\n')}\n`
      + '⚠️ 根因多半是行號映射（`tools/demo/line-map.ts`）——重產那幾張圖。\n').toEqual([])
  })

  it('🔴 硬性零：號碼不得落在空行', () => {
    const bad: string[] = []
    for (const m of maps) {
      const lines = m.code.split('\n')
      for (const b of m.badgeLines) {
        if (b >= 1 && b <= lines.length && lines[b - 1].trim() === '') {
          bad.push(`${m.file}  號碼 ${b} 落在空行`)
        }
      }
    }
    expect(bad, `\n🔴 號碼落在空行（那一行沒有積木，它不該有號碼）：\n${bad.join('\n')}\n`).toEqual([])
  })

  it('🔴 硬性零：每一個號碼都要有一顆【從那一行開始】的積木', () => {
    const bad: string[] = []
    for (const m of maps) {
      const starts = new Set(m.blocks.map((b) => b.startLine))
      for (const b of m.badgeLines) if (!starts.has(b)) bad.push(`${m.file}  號碼 ${b} 沒有對應的積木`)
    }
    expect(bad, `\n🔴 號碼指不到積木：\n${bad.join('\n')}\n`).toEqual([])
  })

  it('★ 注入：三條判準都要認得出合成的壞資料', () => {
    const fake = { code: 'a\n\nb', badgeLines: [2, 9], blocks: [{ startLine: 1, endLine: 1 }] }
    const n = fake.code.split('\n').length
    expect(fake.badgeLines.some((b) => b > n), '「超出行數」認不出來').toBe(true)
    expect(fake.code.split('\n')[1].trim() === '', '「落在空行」認不出來').toBe(true)
    expect(new Set(fake.blocks.map((b) => b.startLine)).has(2), '「指不到積木」認不出來').toBe(false)
  })
})
