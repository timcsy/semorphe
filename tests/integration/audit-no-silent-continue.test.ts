/**
 * **第七十五條護欄**：碰到沒看過的東西，不得有「繼續」這個答案。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字（`vision.md:524`）：
 *
 * > 「**如果沒看過的東西就不要執行下去了，要誠實的說沒看過**」
 *
 * 而在此之前，程式碼給學生的選項是反過來的。`execution-controller.ts` 的
 * 退路訊息逐字：
 *
 * ```
 * Unknown component "%1" encountered.
 * Click OK to skip it and continue, or Cancel to stop execution.
 * ```
 *
 * 而 `interpreter.ts` 那一支的註解逐字寫著 `// 'skip' — 繼續執行`。
 *
 * ## 🔴 為什麼「跳過」是這個系統裡最貴的一個選項
 *
 * ```
 * 跳過一個【輸出】     少印一行            ← 看得出來
 * 跳過一個【賦值】     後面每一行都在讀錯的值 ← 看不出來，而且每一步都【正常】
 * ```
 *
 * `draft/2026-08-24-執行遇到沒看過的東西.md:28` 逐字：
 *
 * > 🔴 **`'skip'` 不是「跳過一行」，是「帶著錯的狀態繼續跑」**
 *
 * 它同構於 `concepts/模擬的誠實.md:23`：
 *
 * > **一個每次讀到不同值的模擬器，測不出任何東西。**
 *
 * 一個跳過就繼續的直譯器，跑出來的輸出與那支程式無關——**而學生會拿它當答案**。
 *
 * 它服務的是 `principles.md:135`（P6 誠實降級，推導自根公理）：
 *
 * > 降級必須單調遞減、**必須可見**、必須區分原因
 *
 * ⚠️ 而 `principles.md:206` 的檢驗表更直接：
 * 「這裡出錯會有人發現嗎」答案是「不會」的每一處，**都是等待發生的靜默降級**。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「掃到的 `src/` 檔數」或「讀進的字數」低於下限，代表掃描器沒讀到檔案，
 * > 這份報表不算數——不是「沒有人在偷偷繼續」。**
 *
 * 錨在**掃到幾個檔／讀進幾個字**：拿掉一個 `'skip'` 之後檔案還在、字數還在，
 * 🔴 **刻意不錨在「還有幾處」**——那正是這條護欄要推向零的
 * （`build-guardrail` 第 2 步，那個形狀在這個 repo 犯過九次）。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 留一條「繼續」的路，「沒看過就不繼續」那句話就是假的
 * 修一筆要付多少？       便宜——把一個回答刪掉，而問題也跟著消失
 * 別台機器一樣嗎？       ✅ 純靜態
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **它量的是【字面值】，不是語義**——`'skip'` 這個字在 `src/` 裡被當成
 *   「這條路的答案」用過，所以這條護欄把那個字視為**已被污染**。
 *   ⚠️ 將來若有人為了無關的事想用這個字，這支會出聲。**那是刻意的摩擦**：
 *   要嘛換個字，要嘛加一筆**具名豁免並寫出理由**。
 * - **不檢測 `isSkipped`／`skipPaths`／`declareSkips`**——那是「**刻意不執行**」，
 *   是概念自己宣告的，與「**沒看過**」是兩件事
 *   （`draft/…執行遇到沒看過的東西.md` §六：「沒看過」有兩種）。
 *   🔴 而 `isSkipped` 今天是一條**靜默 return**，那是**另一刀**的事
 *   ——draft 明文列為未決。**這支不假裝它管到了那裡。**
 * - **不檢測「停下來之後說得夠不夠清楚」**——訊息品質沒有機械判準。
 * - **不檢測 `tests/`**——那裡的 `'skip'` 多半是 `it.skip` 的統計（`disabled-scan`），
 *   完全無關的同名。
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

/**
 * **具名豁免**——每一筆要寫得出理由。空的是對的：這個字現在沒有正當用途。
 * ⚠️ 附孤兒檢查（第 11 步：基線過期會被棘輪抓到，**判定過期不會**）。
 */
const EXEMPT: Record<string, string> = {}

/** 這一行把 `'skip'` 當成一個值在用嗎。 */
export function silentContinueIn(line: string): boolean {
  // 註解裡提到它是可以的——這個檔頭自己就在提它
  const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
  return /(['"])skip\1/.test(code)
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
  const files = tsFiles(path.join(REPO_ROOT, 'src'))
  let chars = 0
  const hits: string[] = []
  for (const f of files) {
    const rel = path.relative(REPO_ROOT, f)
    const src = fs.readFileSync(f, 'utf8')
    chars += src.length
    if (rel in EXEMPT) continue
    src.split('\n').forEach((line, i) => {
      if (silentContinueIn(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 78)}`)
    })
  }
  return { files: files.map((f) => path.relative(REPO_ROOT, f)), chars, hits }
}

describe('第七十五條護欄：沒看過的東西不得有「繼續」這個答案', () => {
  const r = scan()

  it('★ 入口條件：掃描真的吃到東西', () => {
    // ⚠️ 錨在輸入量。刪掉一處 `'skip'` 之後，檔案還在、字數還在。
    expect(r.files.length, '一個 src 檔都沒掃到 → 路徑錯了，下面的 0 是假的').toBeGreaterThan(200)
    expect(r.chars, 'src 讀進來是空的 → 讀檔壞了').toBeGreaterThan(100_000)
  })

  it('★ 注入①：把它當成值在用的都要被報出', () => {
    expect(silentContinueIn("      return skip ? 'skip' : 'abort'")).toBe(true)
    expect(silentContinueIn('  h: ((c: string) => Promise<"skip" | "abort">) | null = null')).toBe(true)
    expect(silentContinueIn("  if (action === 'skip') return")).toBe(true)
  })

  it('★ 注入②：不是那個值的都不得被報', () => {
    // 這一條不可省。沒有它，一個「看到 skip 就報」的實作也能通過注入①
    // ——而那會把 `isSkipped` 那一整族（**刻意不執行**，另一件事）一起報進來。
    expect(silentContinueIn("    if (isSkipped(component, 'execute')) return"), 'isSkipped 是刻意不執行').toBe(false)
    expect(silentContinueIn("  skipPaths: ['execute']"), '宣告的欄位名').toBe(false)
    expect(silentContinueIn('import { declareSkips } from "../core/skip-declarations"'), '匯入').toBe(false)
    expect(silentContinueIn("      // 'skip' — 繼續執行"), '註解不是程式碼').toBe(false)
    expect(silentContinueIn(" * 例如 `return 'skip'` 那條路"), '檔頭的散文').toBe(false)
  })

  it('★ 具名豁免不得變成孤兒', () => {
    const orphans = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(REPO_ROOT, f)))
    expect(orphans, `這些豁免指著不存在的檔案：\n  ${orphans.join('\n  ')}`).toEqual([])
  })

  it('硬性零：`src/` 裡不得有「跳過並繼續」這個答案', () => {
    printReport('第七十五條：沒看過就不繼續', [
      `掃到 src 檔        ${r.files.length}（${r.chars} 字）`,
      `具名豁免           ${Object.keys(EXEMPT).length}`,
      `「繼續」的答案     ${r.hits.length}（硬性零）`,
      ...r.hits.map((h) => `  🔴 ${h}`),
    ])
    expect(
      r.hits,
      '🔴 這些地方讓執行【帶著錯的狀態繼續跑】。\n' +
        '⚠️ 跳過一個賦值之後，後面每一行都在讀錯的值——**而每一步看起來都正常**。\n' +
        '使用者的原話：「沒看過的東西就不要執行下去了，要誠實的說沒看過」。',
    ).toEqual([])
  })
})
