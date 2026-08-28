/**
 * @vitest-environment happy-dom
 *
 * **狀態列最右那格語言——它在什麼時候不是廢話**。
 *
 * ## 它從哪來
 *
 * 使用者（2026-08-27）：「網頁版最右邊的 C++ **不能切換語言也很怪，感覺有點多餘**」。
 *
 * 查證：那一格是刻意模仿 VSCode 的（`app-shell.ts` 註解逐字
 * 「⚠️ 語言掛在最右，那是 VSCode 擺語言模式的位置」）——**而 VSCode 那一格可以點**。
 *
 * > **抄了位置，沒抄它的能力——於是它看起來像一顆壞掉的按鈕。**
 *
 * ## 🔴 而它只在某些情境下多餘
 *
 * `FIELD_OWNERSHIP` 把兩者分在兩邊：`targetId` 是 `context`（我在教什麼）、
 * `language` 是 `document`（這個檔案是什麼語言）。
 *
 * ```
 * 目標 = C++（預設）  → 語言 C++     🔴 重複
 * 目標 = Arduino Uno  → 語言 C++     🟢 有資訊（Arduino 寫的是 C++）
 * 目標 = Python 入門  → 語言 Python  🟢 有資訊（而目標名已說出來 → 仍然重複）
 * ```
 *
 * > **一格資訊在一種情境下重複、在另一種情境下必要
 * > ——而它原本用同一種方式呈現兩者。**
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測那條列上其餘幾格**——它們是控制項，由登錄表渲染
 * - ⚠️ **不檢測「目標名剛好含有語言字樣而其實無關」**的情況
 *   （例如一個叫「C++ 以外的東西」的目標）——判準是寬鬆包含，那是已知的邊界
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { updateStatusBar } from '../../../src/ui/app-shell'
import type { StylePreset } from '../../../src/core/types'

const STYLE = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
} as unknown as StylePreset

const summary = (): string =>
  document.getElementById('status-summary')?.textContent ?? '<沒有那一格>'

const run = (languageName: string, targetName?: string): string => {
  updateStatusBar(STYLE, 'zh-TW', 'zelos', '初學 C++', languageName, undefined, targetName)
  return summary()
}

describe('狀態列的語言那一格', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<footer id="status-bar"><span id="status-summary">x</span></footer>'
  })

  it('★ 入口條件：那一格真的被寫過（否則下面的空字串是假的）', () => {
    expect(run('Python', 'Arduino Uno'), '🔴 它根本沒被寫 → 下面在測初始值').toBe('Python')
  })

  it('🔴 目標的名字已經說出語言 → 不畫', () => {
    expect(run('C++', 'C++（預設）'), '🔴 講了兩次').toBe('')
    expect(run('Python', 'Python 入門'), '🔴 講了兩次').toBe('')
  })

  it('🔴 目標的名字【沒有】說出語言 → 要畫（那一格有資訊）', () => {
    // Arduino 寫的是 C++——而那對初學者是重要的資訊
    expect(run('C++', 'Arduino Uno'), '🔴 把有資訊的那一格也刪掉了').toBe('C++')
    expect(run('C++', 'ESP32-S3')).toBe('C++')
  })

  it('★ 反向：不知道目標叫什麼時【照畫】', () => {
    // ⚠️ 少了這一條，一個「不確定就藏起來」的實作也會通過上面兩支
    //    ——而它的症狀是裸的那條列（測試、舊宿主）少一格資訊。
    expect(run('C++', undefined), '🔴 不知道目標就把資訊藏了').toBe('C++')
    expect(run('C++', ''), '空字串也算不知道').toBe('C++')
  })

  it('★ 比對要吃得下全形括號與大小寫', () => {
    expect(run('C++', 'c++（預設）'), '大小寫').toBe('')
    expect(run('C++', 'C++ (default)'), '半形括號').toBe('')
  })
})

/**
 * **程式風格併進目標**——2026-08-27，使用者：
 * 「程式風格現在先跟目標合併好了，先選目標再選課程，然後積木風格怎麼選不影響」。
 *
 * 🔴 而查證下來**那個合併早就做完了**：`Target` 宣告 `style`，13 個目標全部填了，
 * 而 `handleTargetChange` 切目標時就會 `applyStylePreset`。
 * `storage-version.test.ts:72` 的註解逐字：
 * 「**目標取代了『課程清單 ＋ 風格』兩次分開的選擇**」。
 *
 * **沒收尾的地方是狀態列那顆 picker**，而它的症狀不是「多一顆按鈕」：
 *
 * ```
 * 選 arduino-uno  → style 自動變 google
 * 手動改 style     → 目標仍然說它該是 google
 *                    → 兩個東西不一致，而【那個狀態沒有名字】
 * ```
 *
 * > **一個宣告了預設值、而又留著一顆手動選單的欄位，
 * > 會產生「宣告說 A、實際是 B」的狀態——而它沒有名字。**
 */
describe('控制項登錄表：程式風格已由目標決定', () => {
  it('🪦 `style` 不再是一顆 picker', async () => {
    const { CONTROLS } = await import('../../../src/core/host/controls')
    const ids = CONTROLS.map((c) => c.id)
    expect(ids, '入口條件：登錄表是空的 → 下面在測空集合').toContain('target')
    expect(ids, '🔴 它又長回來了——而它已經由目標決定').not.toContain('style')
  })

  it('🔴 每一個風格都有目標指得到它——退場不失去能力', async () => {
    // ⚠️ 這一條是「可以拿掉那顆 picker」的**前提**：picker 沒了之後，
    //    一個沒有目標指到的風格就【使用者拿不到】（`可拿性` 那條護欄的同一族）。
    //
    // 🔴 第一版寫成「一個寫死的清單自己比自己」——那**測不出任何東西**。
    //    > 一個把答案抄在題目旁邊的測試，永遠是綠的。
    //    改成真的去讀那兩份宣告。
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { findFiles } = await import('../../helpers/find-files')
    // 🔴 **錨在 `__dirname`，不是 `process.cwd()`**，而且**不用 `fs.globSync`**
    //    ——那兩樣東西讓這一支在本機綠、在 CI（Node 24 / Linux）掃到 0，
    //    於是入口條件當場紅，而 CI 從 2026-08-27 起一直是紅的。
    //    見 `tests/helpers/find-files.ts` 的檔頭。
    const styleDir = path.resolve(__dirname, '../../../src/languages')
    const styles = findFiles(styleDir, 'styles')
    const targets = findFiles(styleDir, 'targets')
    expect(styles.length, '入口條件：一個風格檔都沒掃到 → 下面在測空集合').toBeGreaterThan(3)
    expect(targets.length, '入口條件：一個目標檔都沒掃到').toBeGreaterThan(3)

    const claimed = new Set(
      targets.map((f) => JSON.parse(fs.readFileSync(path.join(styleDir, f), 'utf8')).style as string),
    )
    const orphans = styles
      .map((f) => path.basename(f, '.json'))
      .filter((id) => !claimed.has(id))
    expect(
      orphans,
      `🔴 這些風格沒有任何目標指到它 → picker 退場之後【使用者拿不到】：${orphans.join('／')}`,
    ).toEqual([])
  })
})
