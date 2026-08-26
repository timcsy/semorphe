/**
 * **第七十五條護欄**：碰到沒看過的東西，不得**無聲地**繼續。
 *
 * ## 🔴 這條規範改寫過一次，而那不是措辭問題（2026-08-26）
 *
 * 它 2026-08-26 上午立的時候寫的是「**不得有「繼續」這個答案**」，
 * 依據是使用者「沒看過的東西就不要執行下去了」。當天下午使用者把它推翻：
 *
 * > 「這不能直接跑，而是跑到那邊**要有斷點**，讓使用者**調整完狀態**
 * >  才能繼續跑下去，或是**直接停止**」
 *
 * 也就是說：**繼續是可以的，而它有前提**。舊的規範把前提誤讀成禁令。
 *
 * ```
 * 舊 'skip'   一個 confirm() 問「要不要跳過」   看不到停在哪 · 看不到變數 · 改不動
 * 現在        停在那一行（與斷點同一條路）      看得到 · 改得動 · 然後【明確】決定
 * ```
 *
 * > **差別不在那個回答叫什麼，在回答的人有沒有被給到判斷的依據。**
 *
 * ⚠️ 而改寫的時候**差一點就用「換個字」矇混過去**——實作改叫 `'continue'`，
 * 這條護欄當場變綠而一個字都沒改。**那是最容易發生的那種假通過**：
 * 護欄還在、還是綠的，而它量的東西已經與規範無關了。
 * → 所以下面同時留了「`'skip'` 不得回來」（舊設計的墓碑）
 *   與**真正的那條**（沒有宿主時不得返回）。
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
 * ## 🔴 為什麼「無聲地跳過」是這個系統裡最貴的一個選項
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
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'

/** 合成的節點——⚠️ **刻意不是任何真實身分**（`build-guardrail` 簽名三）。 */
const node = (componentId: string): SemanticNode =>
  ({ id: 'n-probe', componentId, properties: {}, children: {} }) as unknown as SemanticNode

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

describe('第七十五條護欄：沒看過的東西不得無聲地繼續', () => {
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

  it('🔴 硬性零（行為）：**沒有宿主可問時，不得返回**', async () => {
    // 這一條才是規範本身。上面那條只是舊設計的墓碑——
    // ⚠️ **一個只擋字串的護欄，換個字就通過了**，而 2026-08-26 差一點就是那樣。
    //
    // 「無聲」的定義：**沒有任何人被問，而它繼續了**。
    // 一個沒有 UI 的宿主（Node、測試、`examples/bring-your-own-view/`）
    // 沒有人可以問，所以它的唯一正確處置是停止。
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    await expect(
      interp.executeNode(node('cpp:this_does_not_exist')),
      '🔴 沒有註冊宿主而它沒有丟 → 那就是【無聲地繼續】',
    ).rejects.toThrow()
  })

  it('🔴 暫停要**指得出位置**——指不出來的暫停不是斷點', async () => {
    // 使用者要的是「跑到那邊要有斷點」。一個說得出「有東西不會跑」
    // 而說不出「在哪一行」的暫停，學生沒有辦法對它做任何事。
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const seen: Array<{ component: string; nodeId: string | null }> = []
    interp.setUnknownComponentPause(async (component, nodeId) => {
      seen.push({ component, nodeId })
      return 'stop'
    })
    await interp.executeNode(node('cpp:this_does_not_exist')).catch(() => {})
    expect(seen).toHaveLength(1)
    expect(seen[0].component).toBe('cpp:this_does_not_exist')
    expect(seen[0].nodeId, '🔴 宿主拿不到節點 id → 它指不到那一顆積木上').toBe('n-probe')
  })

  it('★ 反向：宿主說「繼續」時**才**繼續——而那是它明確說的', async () => {
    // 缺了這一條，一個「永遠丟」的實作也能通過上面兩條，
    // 而那會讓使用者的「調整完狀態才能繼續跑下去」變成做不到。
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    interp.setUnknownComponentPause(async () => 'continue')
    await expect(interp.executeNode(node('cpp:this_does_not_exist'))).resolves.toBeUndefined()
  })

  it('★ 具名豁免不得變成孤兒', () => {
    const orphans = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(REPO_ROOT, f)))
    expect(orphans, `這些豁免指著不存在的檔案：\n  ${orphans.join('\n  ')}`).toEqual([])
  })

  it('🪦 硬性零：舊設計的那個字不得回來（`\'skip\'`）', () => {
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
