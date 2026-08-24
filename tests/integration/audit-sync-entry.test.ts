/**
 * **第六十二條護欄：同步的入口不得硬編視圖的名字。**
 *
 * ## 這條從哪來
 *
 * 使用者 2026-08-24：「**同步按鈕的部分我想要重新設計，因為加入了流程面板，
 * 會更加複雜**。」
 *
 * 而查證之後複雜的來源不是面板數量，是**那兩顆按鈕在做兩件事**：
 *
 * ```
 * (a) 現在同步一下   → 時機   自動同步開著時不必要
 * (b) 以這一邊為準   → 來源   兩邊分岔時無可取代
 * ```
 *
 * 方向是 **N²**，來源只有 **N**。舊的兩顆把 (a)(b) 寫成同一顆，
 * 所以第三個可編輯視圖出現時它會爆炸。
 *
 * > **一份寫在 HTML 裡的「可編輯視圖清單」，與一份寫在程式碼裡的手寫清單
 * > 是同一個東西——只是沒有人把它看成清單。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果這支護欄在「方向按鈕還好好地掛在工具列上」的情況下報零，
 * > 代表它掃的檔案集合不對——那是工具壞了。**
 *
 * 判斷依據是 `★ 合成注入`那兩支（餵合成的原始碼給判定函式），
 * **不是**真實那個零。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「三態長什麼樣」**——那是行為，由 `sync-coordinator` 的單元測驗。
 * - **不檢測宿主那一側**（VSCode／Theia 的狀態列項目）——
 *   `ship-extension` 逐字：「驗得到我送了什麼，驗不到對面怎麼處理，
 *   **更驗不到 Theia 與 Chromium 的差異**」。那一半只能人工。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

/** 方向按鈕的簽名：一個 id 同時說了「同步」與「哪一邊」 */
export function directionButtons(source: string): string[] {
  return [...source.matchAll(/id="(sync-(?:blocks|code)-btn)"/g)].map((m) => m[1])
}

/** `viewsWith('editable')` 的讀取點——只認具名呼叫 */
export function editableReaders(source: string): number {
  return source.match(/viewsWith\(\s*['"]editable['"]\s*\)/g)?.length ?? 0
}

/**
 * ⚠️ **宣告處自己不算讀取點**——`view-registry.ts` 的檔頭與簽名裡就寫著
 * `viewsWith('editable')`，而第一版把它數成一個消費者，於是那條硬性零
 * **一開始就是綠的**（假綠）。
 *
 * > **字串剛好出現在某處不算讀取——那可能只是它自己的宣告。**
 * > （`annotation-adoption` 的同一條，第二次踩。）
 */
const DECLARATION_SITE = 'src/core/view-registry.ts'

function uiSources(): { files: number; text: string } {
  let text = ''
  let files = 0
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && rel !== DECLARATION_SITE) {
        text += fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
        files++
      }
    }
  }
  walk('src/ui')
  walk('src/core')
  return { text, files }
}

const scanned = uiSources()

describe('護欄：同步的入口（第六十二條）', () => {
  it('★ 合成注入：方向按鈕必須被抓到', () => {
    expect(directionButtons(`<button id="sync-blocks-btn" title="積木 → 程式碼">`)).toEqual(['sync-blocks-btn'])
    expect(directionButtons(`<button id="sync-code-btn">`)).toEqual(['sync-code-btn'])
  })

  it('★ 合成注入：不是方向按鈕的不得亂報', () => {
    expect(directionButtons(`<button id="undo-btn">`), '別的按鈕不算').toEqual([])
    expect(directionButtons(`<button id="mobile-sync-btn">`), '暫停鈕不是方向鈕').toEqual([])
    expect(editableReaders(`viewsWith('needsLanguageProjection')`), '不同能力不得互相計數').toBe(0)
  })

  it('★ 入口條件：真的掃到原始碼了', () => {
    // ⚠️ 錨在**輸入量**上：檔案數不會因為方向按鈕被拿掉而變小
    expect(scanned.files, '一個檔都沒掃到 → 下面那個零是假的').toBeGreaterThan(50)
    expect(scanned.text.length).toBeGreaterThan(200_000)
  })

  it('🔴 硬性零：同步的入口不得有【方向】按鈕', () => {
    expect(
      directionButtons(scanned.text),
      '方向是 N²、來源只有 N——留一顆，第三個可編輯視圖出現時它就要變成六顆',
    ).toEqual([])
  })

  it('🔴 硬性零：來源清單必須從 `viewsWith(\'editable\')` 導出', () => {
    expect(
      editableReaders(scanned.text),
      '沒有人讀那個宣告 → 來源清單是手寫的，而手寫清單會在有人忘記的那天一次付清',
    ).toBeGreaterThan(0)
  })
})
