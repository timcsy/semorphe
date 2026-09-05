/**
 * **第一百零七條護欄：核心不得直接用宿主的儲存 API。**
 *
 * ## 🔴 為什麼需要它
 *
 * `localStorage` 是**一個宿主的東西**：
 *
 * ```
 * Node                  沒有它
 * VSCode 的擴充主程序    沒有它
 * 無痕／擋掉 storage     叫它會拋
 * ```
 *
 * 而 2026-09-06 之前核心裡有 **9 處**直接叫它（`core/storage.ts` 與
 * `core/progress.ts`）。
 *
 * > **一個「核心」如果它的存檔只在一個宿主上跑得起來，
 * > 那它不是核心，是那個宿主的一部分。**
 *
 * ## ⚠️ 為什麼這一條特別容易被還原
 *
 * `localStorage.setItem(…)` 在瀏覽器裡**跑得好好的**——它不會報錯、
 * 不會變慢、不會讓任何測試變紅。壞掉的是**第二個宿主**，
 * 而那個宿主可能一年後才出現。
 *
 * 🔴 那正是 P9 的形狀：**獨立性的破口不會在破的那天出聲。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管 UI 層**（`src/ui/`）——那一層**就是**知道宿主的地方，
 *   瀏覽器實作住在那裡是對的
 * - **不管註解裡提到它**（判準是「後面接著 `.` 或 `[`」＝真的在用）
 * - **不管存的是什麼**（那是存檔格式的護欄在管）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, REPO_ROOT } from '../helpers/guardrail'

/**
 * 宿主的儲存 API——⚠️ 這份清單是**手寫的**，而漏掉一個就等於放它進來。
 *
 * 判準：**它在某一個宿主上不存在嗎**。存在於所有宿主的（`JSON`、`Map`）不算。
 */
const HOST_STORAGE = ['localStorage', 'sessionStorage', 'indexedDB', 'node:fs', 'require(\'fs\')'] as const

interface Hit { file: string; line: number; text: string; api: string }

/**
 * 掃出**真的在用**的那些——不是所有「提到」。
 *
 * 🔴 判準是後面接著 `.` 或 `[`（`localStorage.getItem` / `localStorage['k']`），
 * 或它是一個 import 目標（`node:fs`）。少了這個判準，這條護欄會紅在
 * **解釋它自己的那幾行註解**上——而那會逼下一個人把註解刪掉。
 *
 * > **一條讓人想刪註解才能過的護欄，正在教一件錯的事。**
 */
export function storageUses(
  files: readonly string[],
  read = (f: string): string => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'),
): Hit[] {
  const out: Hit[] = []
  for (const f of files) {
    read(f).split('\n').forEach((text, i) => {
      const t = text.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      for (const api of HOST_STORAGE) {
        const used = api.startsWith('node:') || api.startsWith('require')
          ? text.includes(api)
          : new RegExp(`\\b${api}\\s*[.[]`).test(text)
        if (used) out.push({ file: f, line: i + 1, text: t, api })
      }
    })
  }
  return out
}

const CORE = listSourceFiles('src/core')
const HITS = storageUses(CORE)

describe('第一百零七條護欄：核心不碰宿主的儲存', () => {
  it('★ 入口條件——真的掃到核心了', () => {
    expect(CORE.length, '🔴 一個檔都沒掃到 → 下面每一條都是空過的').toBeGreaterThan(20)
    expect(CORE.some((f) => f.endsWith('storage.ts')),
      '🔴 掃不到 `core/storage.ts`——路徑或檔名改了').toBe(true)
  })

  it('🔴 硬性零：核心不得直接用宿主的儲存 API', () => {
    expect(
      HITS.map((h) => `${h.file}:${h.line}  [${h.api}]  ${h.text.slice(0, 70)}`),
      '🔴 核心綁死了一個宿主的儲存。\n' +
        '   改法：叫 `core/host/key-value-store.ts` 那個埠，\n' +
        '   而**實作住在 `src/ui/`**——那一層才是知道宿主的地方。\n' +
        '   ⚠️ 這個破口不會在破的那天出聲：`localStorage` 在瀏覽器裡跑得好好的，\n' +
        '      壞掉的是第二個宿主，而它可能一年後才出現。',
    ).toEqual([])
  })

  it('★ 注入：核心裡有一行 → 報得出檔名、行號與是哪一個 API', () => {
    const hits = storageUses(['src/core/x.ts'], () =>
      ['export function save(v: string): void {', '  localStorage.setItem(\'k\', v)', '}'].join('\n'))
    expect(hits).toHaveLength(1)
    expect(hits[0].line, '🔴 報不出行號').toBe(2)
    expect(hits[0].api).toBe('localStorage')
  })

  it('★ 注入：乾淨的檔案 → 不得報', () => {
    expect(storageUses(['src/core/x.ts'], () =>
      ['export function save(s: KeyValueStore, v: string): void {', '  s.write(\'k\', v)', '}'].join('\n'))).toEqual([])
  })

  /**
   * ★ ⚠️ **註解裡提到不算**——這一條擋的是一個很容易犯的錯：
   * 一條掃「這個字串有沒有出現」的護欄，會紅在**解釋它自己的那幾行註解**上。
   */
  it('★ 註解裡提到不算一次使用', () => {
    expect(storageUses(['x.ts'], () =>
      ['// 舊的做法是 localStorage.setItem(…)', ' * ⚠️ `localStorage` 是宿主的東西'].join('\n'))).toEqual([])
  })

  /**
   * 🔴 **埠接上了嗎——「機制有了沒人接」是這個 repo 記過的形狀。**
   *
   * 這一刀最容易做錯的地方不是實作，是**只宣告介面而不接上產品路徑**。
   * 而它的症狀特別安靜：
   *
   * ```
   * 存檔     組裝點忘了傳 → 存到【記憶體】→ 重新整理就沒了
   * 進度     忘了叫 setProgressStore → 同上
   * ```
   *
   * ⚠️ 兩者都**不會報錯**，而單元測試（用記憶體實作）**照樣全綠**。
   *
   * > **一個埠如果它的預設實作能讓測試通過，
   * > 那「忘了接」與「接好了」在測試上長得一模一樣。**
   */
  it('🔴 硬性零：埠真的接上產品路徑了', () => {
    const wiring: [file: string, needle: string, what: string][] = [
      ['src/ui/host/web-profile.ts', 'createBrowserStore()', '存檔（網頁版的 StorageService）'],
      ['src/ui/app.ts', 'setProgressStore(', '進度（core/progress.ts 的模組層級 store）'],
    ]
    const missing = wiring
      .filter(([f, needle]) => !fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').includes(needle))
      .map(([f, needle, what]) => `${f} 少了 \`${needle}\` → ${what} 會存到記憶體，重新整理就沒了`)
    expect(
      missing,
      '🔴 **埠宣告了而沒有人接**——那是「機制有了沒人接」的形狀。\n' +
        '   ⚠️ 症狀不會報錯：單元測試用記憶體實作，照樣全綠。',
    ).toEqual([])
  })

  /**
   * ★ **每一個列在清單裡的 API 都真的抓得到**——⚠️ 沒有這一條的話，
   * 清單裡多一個打錯字的名字，看起來像多守了一樣東西，而它守著空氣。
   */
  it('★ 清單上的每一個 API 都抓得到', () => {
    for (const api of HOST_STORAGE) {
      const line = api.startsWith('node:') ? `import fs from '${api}'` : `${api}.getItem('k')`
      expect(storageUses(['x.ts'], () => line).length, `🔴 清單上的 ${api} 抓不到`).toBe(1)
    }
  })
})
