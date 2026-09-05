/**
 * **第八十九條護欄**：`vision.md` 的「進行中」裡每一項，都必須還有事沒做完。
 *
 * ## 它從哪來
 *
 * 這一節**在同一週過期了三次**：
 *
 * ```
 * 2026-08-30 上午  「階段 7……兩筆還開著」   而那一節裡兩個框都是 [x]
 * 2026-08-30 晚間  「骨架在其餘視圖上的顯示   而它同日就交付了（history/191）
 *                    ——in-flight」
 * ```
 *
 * 而它自己的下面三行就寫著：
 *
 * > **一個區段的標題是一句宣稱，而它不會自己去看底下裝了什麼。**
 *
 * 🔴 **散文擋不住它**——那句話就寫在犯錯的地方，而它照樣又發生了兩次。
 * 這是 `build-guardrail` 的核心判準：**一條規範沒有機械化的檢查，
 * 它本身就是殼——而殼看起來像完成。**
 *
 * ## 它量什麼
 *
 * 「進行中」那一節裡每一個**粗體的項目名**，要在 vision 的別處找得到
 * 一個同名的標題，而那個標題底下**至少有一個沒打勾的框**。
 *
 * 🟢 交付的那一刻（最後一個框打勾）它就會紅——而那正是要它出聲的時機。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果 `vision.md` 讀進來的字數低於 20000，代表檔案沒讀到，
 * > 這份報表不算數——不是「進行中都新鮮」。**
 *
 * 錨在**讀進幾個字**（合成量）。🔴 刻意不錨在「過期幾項」——那正是要推向零的。
 * ⚠️ 也**不錨在「進行中有幾項」**：那一節**空的時候是合法的**
 * （vision 自己寫著「空的時候不是壞事」），錨在它上面會讓一次正當的清空變紅。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 留一項過期的，「進行中」這三個字就不能信
 * 修一筆要付多少？      便宜——把它收成一行 ＋ 指標（judge §5 的 redeem-and-retire）
 * 別台機器一樣嗎？      ✅ 純文字掃描
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - 🔴 **不檢測「交付了而沒有人來更新」**——這是它最重要的能力邊界。
 *
 *   那一節過期有**兩種形狀**，而這支只抓得到第一種：
 *
 *   ```
 *   ① 框全打勾了，而它還掛在「進行中」        ✅ 抓得到（階段 7 那次）
 *   ② 東西交付了，而框、標題、draft 都沒動    🔴 抓不到（骨架那次）
 *   ```
 *
 *   ⚠️ ②**在文字上沒有任何訊號**——vision 自己不知道程式已經寫好了。
 *   那要對照程式碼，是 `/knowie-judge` 的活。**這支不假裝它守得住那一半。**
 *
 * - **不檢測「沒打勾的框是不是真的沒做」**——同上。
 * - **不檢測「下一步」那一節**：那裡的項目本來就還沒開工，全部沒打勾是正常的。
 * - **不檢測 `history/` 有沒有對應的轉變**——那是另一條。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import fs from 'node:fs'
import path from 'node:path'

const VISION = path.resolve(__dirname, '../../knowledge/vision.md')

interface Wip { name: string; openBoxes: number; found: boolean }

/** 「進行中」那一節裡，粗體的項目名。 */
export function wipNames(md: string): string[] {
  const i = md.indexOf('### 🟡 進行中')
  if (i < 0) return []
  const j = md.indexOf('\n### ', i + 1)
  const body = md.slice(i, j < 0 ? md.length : j)
  const out: string[] = []
  for (const line of body.split('\n')) {
    // ⚠️ **跳過墓碑**（🪦 開頭那幾行）——它們記的是「已經退場的」，
    //    不是「正在做的」。不跳的話這支會把每一次正確的收尾都報成違規。
    if (line.trimStart().startsWith('🪦')) continue
    // 🔴 **項目的形狀是 `**名字**——說明`**（破折號不可省）。
    //    第一版只要求「行首粗體」，於是把一行散文裡的粗體
    //    （「**它又發生了一次，這次在自己身上。**」）當成了項目名——
    //    對照實驗當場紅在一個**不存在的項目**上。
    //
    // > **一個判準如果寬到把散文也收進來，它報的第一筆多半是它自己。**
    const m = /^\*\*([^*]+)\*\*——/.exec(line.trim())
    if (m && !m[1].startsWith('（')) { out.push(m[1].replace(/（.*$/, '').trim()); continue }
    // 🔴 **`#### 標題` 也是一項**（2026-09-05 補）——而在此之前它不是，
    //    於是「課程的第五刀」三項全部打勾之後，這條護欄**一聲不吭**。
    //
    //    ⚠️ 它漏的不是一個邊界情況：一刀大到要開自己的小節，本來就是
    //    「進行中」最重要的那幾項——**而愈重要的項目愈可能用標題寫**。
    //
    // > **一條「每一項都要還有事沒做完」的護欄，
    // > 如果它的「項」認不出最大的那幾個，它擋住的是最小的那幾個。**
    const h = /^#{4} (.+)$/.exec(line.trim())
    if (h) out.push(h[1].replace(/（.*$/, '').replace(/：.*$/, '').trim())
  }
  return out
}

/** 那個名字底下還有幾個沒打勾的框。 */
export function openBoxesUnder(md: string, name: string): { found: boolean; open: number } {
  const key = name.slice(0, 8)
  const re = new RegExp(`^#{2,4} [^\\n]*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*$`, 'm')
  const m = re.exec(md)
  if (!m) return { found: false, open: 0 }
  const from = m.index + m[0].length
  const next = md.slice(from).search(/\n#{2,4} /)
  const body = md.slice(from, next < 0 ? md.length : from + next)
  return { found: true, open: (body.match(/^- \[ \]/gm) ?? []).length }
}

describe('★ 第八十九條：「進行中」裡的每一項都還有事沒做完', () => {
  const md = fs.readFileSync(VISION, 'utf8')
  const names = wipNames(md)
  const rows: Wip[] = names.map((name) => {
    const r = openBoxesUnder(md, name)
    return { name, openBoxes: r.open, found: r.found }
  })

  it('入口條件——vision 真的讀到了', () => {
    printReport('進行中', [
      `vision 讀進   ${md.length} 字`,
      `進行中的項目  ${names.length}`,
      ...rows.map((r) => `  ${r.found ? '' : '🔴 找不到那一節 '}${r.name}：${r.openBoxes} 個沒打勾`),
    ])
    // ⚠️ 錨在**讀進幾個字**（合成量）——它不會因為違規被修好而變小。
    //    🔴 刻意**不**錨在「進行中有幾項」：那一節空的時候是合法的。
    expect(
      md.length,
      '🔴 vision.md 沒讀到 → 這份報表不算數，不是「進行中都新鮮」',
    ).toBeGreaterThan(20_000)
  })

  it('🔴 硬性零——「進行中」的每一項都要還有沒打勾的框', () => {
    const stale = rows
      .filter((r) => !r.found || r.openBoxes === 0)
      .map((r) => r.found
        ? `${r.name}：底下一個沒打勾的框都沒有 → 它已經做完了`
        : `${r.name}：在 vision 裡找不到同名的那一節`)
    expect(
      stale,
      '🔴 「進行中」裡有已經做完（或找不到）的項目。\n' +
        '> 一個區段的標題是一句宣稱，而它不會自己去看底下裝了什麼。\n' +
        '🟢 修法是 judge §5 的 redeem-and-retire：反流到 `history/`，' +
        '路線圖項收成一行 ＋ 指標，然後把它移出「進行中」。\n' +
        '⚠️ **不要**把它從這支的掃描裡排除——那是把宣稱改成謊話。',
    ).toEqual([])
  })

  it('★ 注入①：一項做完了還留在進行中 → 要報得出來', () => {
    const md2 = [
      '### 🟡 進行中',
      '',
      '**做完的那一刀**——設計脈絡：略。',
      '',
      '### 🔜 下一步（已排序）',
      '',
      '#### 做完的那一刀（2026-08-30）',
      '- [x] 第一件',
      '- [x] 第二件',
    ].join('\n')
    const names2 = wipNames(md2)
    expect(names2, '🔴 連名字都抓不出來').toEqual(['做完的那一刀'])
    expect(openBoxesUnder(md2, names2[0]).open, '🔴 全部打勾了而它說還有沒做的').toBe(0)
  })

  it('★ 注入①b：用 #### 標題寫的一刀做完了 → 也要報得出來', () => {
    const fake = [
      '### 🟡 進行中',
      '',
      '#### 課程的第 N 刀：某某某（2026-09-05 升格）',
      '',
      '- [x] ① 做完了',
      '- [x] ② 也做完了',
      '',
      '### 下一節',
    ].join('\n')
    const names = wipNames(fake)
    expect(names, '🔴 #### 標題沒有被當成一項——那一刀做完了也不會有人說').toContain('課程的第 N 刀')
    expect(openBoxesUnder(fake, '課程的第 N 刀').open).toBe(0)
  })

  it('★ 注入②：還沒做完的不得被報', () => {
    const md2 = [
      '### 🟡 進行中',
      '',
      '**還在做的那一刀**——設計脈絡：略。',
      '',
      '### 🔜 下一步（已排序）',
      '',
      '#### 還在做的那一刀（2026-08-30）',
      '- [x] 第一件',
      '- [ ] 第二件',
    ].join('\n')
    const n = wipNames(md2)
    expect(openBoxesUnder(md2, n[0]).open, '🔴 誤報：它還有一件沒做').toBe(1)
  })

  it('★ 注入③：墓碑不算「進行中的項目」', () => {
    // ⚠️ 少了這一條，每一次正確的收尾（把它標成 🪦）都會被報成違規
    const md2 = ['### 🟡 進行中', '', '**（空）**——沒有在做的。', '',
      '🪦 **那一刀——已交付並退場**（2026-08-30）。', '', '### 🔜 下一步'].join('\n')
    expect(wipNames(md2), '🔴 把墓碑當成進行中的項目了').toEqual([])
  })

  it('★ 注入④：「進行中」是空的 → 合法，不得報', () => {
    // vision 自己寫著「空的時候不是壞事」
    const md2 = ['### 🟡 進行中', '', '**（空）**——下一刀從「下一步」挑。', '', '### 🔜 下一步'].join('\n')
    expect(wipNames(md2)).toEqual([])
  })
})
