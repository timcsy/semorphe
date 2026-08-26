/**
 * **第七十七條護欄**：問人這件事，不走瀏覽器的原生對話框。
 *
 * ## 它從哪來
 *
 * `ui/prompt-dialog.ts:4` 已經為 `window.prompt` 做過這件事，理由逐字三點：
 *
 * ```
 * 難看                    瀏覽器的原生對話框，與整個介面格格不入
 * 🔴 VSCode 裡【不會出現】  Electron 的 webview 停用了 window.prompt
 *                          ——症狀是【點了沒反應】，而不是報錯
 * 阻塞                     它【凍住整個頁面】（自動化工具也一起凍住）
 * ```
 *
 * `ui/toolbar/style-action-bar.ts:3` 也做過一次，逐字：
 * 「**Replaces confirm() dialogs** with an inline notification bar + action buttons」。
 *
 * 🔴 **兩次替換都做了，而 `execution-controller` 裡還有三處 `confirm()`**
 * ——三段一字不差的複製，問的是「積木改過了，要先同步嗎？」。
 *
 * > **一個專案做過兩次同樣的替換而還有殘留，代表那個決定沒有機構在守。**
 *
 * ## ⚠️ 這條護欄的理由，只用【已驗證的那一半】
 *
 * ```
 * 🟢 已驗證   confirm() 阻塞整個頁面，自動化工具也一起凍住
 *            （而 e2e 對那三處【零覆蓋】——`grep dialog|confirm e2e/` 零命中，
 *              那不是巧合：一個會凍住 Playwright 的東西，測試寫不下去）
 * 🟡 未驗證   confirm() 在 VSCode 的 webview 裡會不會「點了沒反應」
 *            —— `prompt-dialog.ts` 的那個證據是關於 `window.prompt`，不是 `confirm`。
 *            **所以這裡不拿它當理由。** 哪天驗了再補進來。
 * ```
 *
 * > **一條護欄如果拿一個沒驗過的前提當理由，那個前提遲早會被人拿去推別的事。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「掃到的 `src/ui` 檔數」或「讀進的字數」低於下限，代表掃描器沒讀到檔案，
 * > 這份報表不算數——不是「原生對話框清光了」。**
 *
 * 錨在**掃到幾個檔／讀進幾個字**：換掉一處之後檔案還在、字數還在。
 * 🔴 **刻意不錨在「還有幾處」**——那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 留一個原生對話框，「問人走頁面」那句話就是假的
 * 修一筆要付多少？       中等——要換載體，而**答案的語義不變**
 * 別台機器一樣嗎？       ✅ 純靜態
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 `alert()`**——它不問問題，只通知；而通知這個專案走 `showToast`。
 *   ⚠️ 哪天有人用 `alert` 問問題，這支看不到。**那時要擴充這支，不是放寬。**
 * - **不檢測「換上去的那個問句好不好用」**——沒有機械判準。
 * - **不檢測 `tests/`／`e2e/`**——測試裡談論 `confirm` 是正當的。
 * - ⚠️ **不檢測 `core/`／`languages/`**——那兩層本來就不該碰 DOM，
 *   而守那件事的是中立性與第五十八條（可攜核心），不是這一條。
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

/** 具名豁免——空的是對的：頁內對話框已經有兩份現成的實作。 */
const EXEMPT: Record<string, string> = {}

/** 這一行在**呼叫**原生對話框嗎。 */
export function nativeDialogIn(line: string): boolean {
  const code = line.replace(/\/\/.*$/, '')
  if (/^\s*\*/.test(line)) return false // 區塊註解
  return /(^|[^.\w])(confirm|prompt)\s*\(/.test(code) || /\bwindow\.(confirm|prompt)\b/.test(code)
}

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...tsFiles(p))
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

const scan = (): { files: string[]; chars: number; hits: string[] } => {
  const files = tsFiles(path.join(REPO_ROOT, 'src/ui'))
  let chars = 0
  const hits: string[] = []
  for (const f of files) {
    const rel = path.relative(REPO_ROOT, f)
    const src = fs.readFileSync(f, 'utf8')
    chars += src.length
    if (rel in EXEMPT) continue
    src.split('\n').forEach((line, i) => {
      if (nativeDialogIn(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 76)}`)
    })
  }
  return { files: files.map((f) => path.relative(REPO_ROOT, f)), chars, hits }
}

describe('第七十七條護欄：問人不走瀏覽器的原生對話框', () => {
  const r = scan()

  it('★ 入口條件：掃描真的吃到東西', () => {
    expect(r.files.length, `一個 src/ui 檔都沒掃到 → 路徑錯了`).toBeGreaterThan(20)
    expect(r.chars, 'src/ui 讀進來是空的 → 讀檔壞了').toBeGreaterThan(100_000)
  })

  it('★ 注入①：呼叫原生對話框的都要被報出', () => {
    expect(nativeDialogIn("      const ok = confirm('really?')")).toBe(true)
    expect(nativeDialogIn('  const v = window.prompt("name")')).toBe(true)
    expect(nativeDialogIn('    if (confirm(MSG)) doIt()')).toBe(true)
  })

  it('★ 注入②：不是呼叫原生對話框的都不得被報', () => {
    // 這一條不可省。沒有它，一個「看到 confirm 就報」的實作也能通過注入①。
    expect(nativeDialogIn('  showPrompt(message, defaultValue, callback)'), '自家的頁內版').toBe(false)
    expect(nativeDialogIn('  Blockly.dialog.setPrompt((m, d, cb) => {'), '設定 Blockly 的鉤子').toBe(false)
    expect(nativeDialogIn('  // 而那件事今天用的是 confirm()，同一個病'), '註解').toBe(false)
    expect(nativeDialogIn(' * Replaces confirm() dialogs with an inline bar'), '區塊註解').toBe(false)
    expect(nativeDialogIn('  const confirmed = state.confirm'), '同名的屬性，不是呼叫').toBe(false)
  })

  it('★ 具名豁免不得變成孤兒', () => {
    const orphans = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(REPO_ROOT, f)))
    expect(orphans).toEqual([])
  })

  it('硬性零：`src/ui/` 不得呼叫 `confirm()`／`window.prompt`', () => {
    printReport('第七十七條：原生對話框', [
      `掃到 src/ui 檔     ${r.files.length}（${r.chars} 字）`,
      `具名豁免           ${Object.keys(EXEMPT).length}`,
      `原生對話框         ${r.hits.length}（硬性零）`,
      ...r.hits.map((h) => `  🔴 ${h}`),
    ])
    expect(
      r.hits,
      '🔴 這些地方用瀏覽器的原生對話框問人。它**凍住整個頁面**（自動化工具也一起凍住）\n' +
        '——而 e2e 對它們零覆蓋，那不是巧合。\n' +
        '頁內的替代品已經有兩份：`ui/prompt-dialog.ts` 與 `ui/toolbar/style-action-bar.ts`。',
    ).toEqual([])
  })
})
