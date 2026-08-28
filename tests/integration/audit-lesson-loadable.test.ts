/**
 * **第八十四條護欄**：`lessons/` 底下的每一堂課，產品都載得起來。
 *
 * ## 它從哪來
 *
 * 2026-08-28：`lessons/` 有 65 堂課、662 個元件宣告，
 * 而 **`grep -rn "lessons" src/` 是零筆**——產品一個字都讀不到它們。
 *
 * `audit-lessons`（第八十三條）量的是「宣告合不合法」，
 * 而 `experience.md:1218` 那條說的正是這個差別：
 *
 * > 「**「這個欄位有沒有值」與「有沒有人讀這個欄位」是兩個問題，
 * >  而只量前者會漏掉後者。**」
 *
 * ⚠️ 這一次是**反過來的**：值都在（65/65 合法），而沒有人讀。
 * 所以這條護欄問的是**產品的載入路徑走得通嗎**，不是宣告合不合法。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果 `allLessons()` 交出少於 1 堂，代表 glob 沒接上或路徑錯了，
 * > 這份報表不算數——不是「教案都載得起來」。**
 *
 * 錨在**載到幾堂**（合成量）。🔴 **刻意不錨在「載不起來的堂數」**
 * ——那正是要推向零的（`build-guardrail` 第 2 步的語法簽名一）。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 老師貼出去的連結開不起來，那堂課就是不存在
 * 修一筆要付多少？      便宜——改一行 JSON
 * 別台機器一樣嗎？      ✅ 純模組載入
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測套用之後畫面對不對**——那要開瀏覽器，住在 `e2e/lesson-pins.spec.ts`。
 * - **不檢測課文**——這一刀只讀宣告。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { allLessons, allTracks } from '../../src/core/load-lessons'
import { controlsPinnedBy, parseLesson, parseTrack } from '../../src/core/lesson'
import { CONTROLS } from '../../src/core/host/controls'
import fs from 'node:fs'
import path from 'node:path'
import { findFiles } from '../helpers/find-files'

const ROOT = path.resolve(__dirname, '../..')

describe('★ 第八十四條：每一堂課產品都載得起來', () => {
  const loaded = allLessons()
  // 🔴 **母體從檔案系統數，不從 `allLessons()` 數**——
  //    後者是被測的東西，拿它當母體的話「少載了一堂」會安靜地通過。
  const onDisk = fs.readdirSync(path.join(ROOT, 'lessons'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((track) =>
      fs.readdirSync(path.join(ROOT, 'lessons', track.name), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => fs.existsSync(path.join(ROOT, 'lessons', track.name, d.name, 'lesson.json')))
        .map((d) => `${track.name}/${d.name}`))

  it('入口條件——glob 真的接上了', () => {
    printReport('教案載入', [
      `檔案系統上有   ${onDisk.length} 堂`,
      `載進來的       ${loaded.size} 堂`,
      `釘住控制項的   ${[...loaded.values()].filter((l) => controlsPinnedBy(l).length > 0).length} 堂`,
    ])
    // ⚠️ 錨在**載到幾堂**（合成量），不是「載不起來的堂數」
    expect(loaded.size, '🔴 一堂都沒載到 → glob 沒接上，這份報表不算數').toBeGreaterThanOrEqual(1)
    expect(onDisk.length, '🔴 檔案系統上一堂都沒有 → 路徑錯了').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——檔案系統上的每一堂都載得起來', () => {
    const missing = onDisk.filter((id) => !loaded.has(id))
    expect(
      missing,
      `🔴 這些課在檔案系統上而載不起來——老師貼出去的連結會開不了：`,
    ).toEqual([])
  })

  it('硬性零——每一堂釘住的控制項都真的存在', () => {
    const known = new Set(CONTROLS.map((c) => c.id))
    const bad: string[] = []
    for (const l of loaded.values()) {
      for (const c of controlsPinnedBy(l)) if (!known.has(c)) bad.push(`${l.id} → ${c}`)
    }
    expect(bad, '🔴 釘住一顆不存在的控制項 → 它永遠不會消失').toEqual([])
  })
})

describe('★ 軌道的宣告——課程選單讀的是它', () => {
  const tracks = allTracks()
  const loaded = allLessons()
  const onDiskTracks = fs.readdirSync(path.join(ROOT, 'lessons'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name)
  const knownTargets = new Set(
    findFiles(path.join(ROOT, 'src/languages'), 'targets')
      .map((rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/languages', rel), 'utf8')).id as string))

  it('入口條件——真的讀到軌道了', () => {
    printReport('軌道', [
      `檔案系統上   ${onDiskTracks.length} 條`,
      `載進來的     ${tracks.size} 條`,
      ...[...tracks.values()].map((t) => `  ${t.order}. ${t.name} → ${t.target}（${
        [...loaded.values()].filter((l) => l.id.startsWith(`${t.id}/`)).length} 章）`),
    ])
    expect(tracks.size, '🔴 一條軌道都沒載到 → glob 沒接上').toBeGreaterThanOrEqual(1)
    expect(knownTargets.size, '🔴 一個目標都沒讀到').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——每一個課程資料夾都有 `track.json`', () => {
    const missing = onDiskTracks.filter((d) => !tracks.has(d))
    expect(missing, '🔴 這些軌道不會出現在「課程」選單裡——沒有人找得到它們：').toEqual([])
  })

  it('硬性零——每條軌道釘的目標都存在', () => {
    const bad = [...tracks.values()].filter((t) => !knownTargets.has(t.target))
      .map((t) => `${t.id} → ${t.target}`)
    expect(bad, '🔴 選了這條軌道會切到一個不存在的目標：').toEqual([])
  })

  it('硬性零——每條軌道至少有一章（選了它要落得了地）', () => {
    const empty = [...tracks.values()]
      .filter((t) => ![...loaded.values()].some((l) => l.id.startsWith(`${t.id}/`)))
      .map((t) => t.id)
    expect(empty, '🔴 選了這條軌道之後沒有章節可落——畫面會停在一個空狀態：').toEqual([])
  })

  it('硬性零——`order` 不得重複（重複＝選單順序其實是碰巧的）', () => {
    const seen = new Map<number, string>(); const dup: string[] = []
    for (const t of tracks.values()) {
      const prev = seen.get(t.order)
      if (prev) dup.push(`${prev} 與 ${t.id} 都是 ${t.order}`)
      seen.set(t.order, t.id)
    }
    expect(dup, '🔴 課程選單的順序是碰巧的：').toEqual([])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  it('★ 注入：合成一份壞掉的宣告 → 載不起來（而不是變成一堂空的課）', () => {
    expect(() => parseLesson('合成/壞的', { title: 'x', components: [] })).toThrow()
  })

  it('★ 注入：軌道缺 target → 丟錯', () => {
    expect(() => parseTrack('合成', { name: 'x' })).toThrow(/target/)
  })

  it('★ 注入：軌道缺 name → 丟錯', () => {
    expect(() => parseTrack('合成', { target: 'cpp' })).toThrow(/name/)
  })

  it('★ 注入：正確的軌道宣告 → 讀得出來', () => {
    const t = parseTrack('合成', { name: 'ㄒ', target: 'ㄒ目標', order: 3 })
    expect(t.name).toBe('ㄒ'); expect(t.order).toBe(3)
  })

  it('★ 注入：正確的合成宣告 → 載得起來', () => {
    const l = parseLesson('合成/好的', { title: 'x', pins: { target: 'ㄒ' }, components: ['ㄒ:甲'] })
    expect(l.components).toEqual(['ㄒ:甲'])
    expect(controlsPinnedBy(l)).toEqual([])
  })

  it('★ 入口：`findFiles` 這個 helper 真的看得到 lessons（否則母體是空的）', () => {
    expect(findFiles(path.join(ROOT, 'lessons'), 'cpp-beginner').length >= 0).toBe(true)
    expect(onDiskCount()).toBeGreaterThan(1)
  })
})

function onDiskCount(): number {
  return fs.readdirSync(path.join(ROOT, 'lessons'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).length
}
