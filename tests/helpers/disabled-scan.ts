/**
 * 停用測試的掃描與標記解析（缺陷帳護欄用）
 *
 * ## 標記語法
 *
 * 寫在測試／區塊的**標題開頭**：
 *
 *   [BLOCKED:<componentId>]   缺陷，被某個**已存在**的元件擋住 → 要**修**它
 *   [UNSUPPORTED:<描述>]      被一個**還不存在**的概念擋住     → 要**加**它
 *   [TOMBSTONE:<檔名#錨點>]    已否決決定的正確後果              → **不該**修
 *   [DEADSKIP]                已修好但沒開回來                  → 開回來就好
 *   [UNVERIFIED]              **不知道為什麼停用**——先前的標記來自檔案層級
 *                             的推測，而那個推測被證實會錯               → 先去查
 *
 * `[UNVERIFIED]` 是誠實的狀態，不是偷懶：沒有它，「我知道它停用、但不知道
 * 為什麼」只有兩條路——留空（會被判為未分類而失敗）或編一個阻斷者（把不確定
 * 偽裝成確定）。兩條都比承認「還沒查」差。它的**數量本身是棘輪**，只准下降，
 * 避免它變成新垃圾桶。
 *
 * BLOCKED 與 UNSUPPORTED 必須分開：一個是「修一個元件」、一個是「加一個元件」，
 * 混在一起會讓「修哪個解鎖最多」的彙總誤導。
 *
 * 標記與測試**同住**，不可能漂移。獨立的登錄檔會立刻長成第二個真相源
 * ——那是本專案頭號病灶。
 *
 * 見 specs/049-audit-guardrails/contracts/README.md 契約 2
 */
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './guardrail'

export type TagType = 'BLOCKED' | 'UNSUPPORTED' | 'TOMBSTONE' | 'DEADSKIP' | 'UNVERIFIED'

export interface Tag {
  type: TagType
  /** type=BLOCKED 時的阻斷者 componentId */
  blocker?: string
  /** type=TOMBSTONE 時的決策記錄參照（檔名#錨點） */
  tombstoneRef?: string
  /** type=UNSUPPORTED 時的描述——還不存在的概念叫什麼 */
  wanted?: string
}

export interface DisabledEntry {
  file: string
  line: number
  kind: 'todo' | 'skip' | 'fails'
  /** 區塊停用會覆蓋多個測試（FR-035） */
  scope: 'test' | 'describe'
  /**
   * 這個停用項目**有沒有測試本體**。
   *
   * `it.skip('x', () => {...})` 有——它是一個真的測試，被關掉了，修好缺口就能開回來。
   * `it.todo('x')` **沒有**——它只是一個名字，測試程式從來不存在，要讓它變成
   * 真的測試得**重新產生**。
   *
   * 兩者需要完全不同的工作量，混在一起統計會讓優先序失真——而優先序是缺陷帳
   * 存在的唯一理由。見 specs/050-repay-top-blockers/research.md F4／F6。
   */
  hasBody: boolean
  title: string
  tag: Tag | null
}

/**
 * `it.todo('...')` / `it.skip('...')` / `describe.skip('...')` / `it.fails('...')`
 *
 * ## ⚠️ `fails` 是 2026-08-10 才加進來的，而在那之前它是**隱形的**
 *
 * `build-guardrail` 明確推薦用 `it.fails` 釘住已知缺陷——它會跑，
 * 缺陷還在時綠、修好時紅並提醒拔釘子，比 `it.skip` 好。
 *
 * **而缺陷帳看不到它。** 於是「用推薦的方式釘住缺陷」＝「那筆缺陷從帳上消失」
 * ——一個獎勵錯誤行為的量測。
 *
 * 這是同一個月裡第三個「低報到零」的盲區（前兩個：掃描範圍不含
 * `src/components/`、跨行寫的停用宣告）。三個的形狀相同：
 * **一筆看不見的缺陷，與一筆不存在的缺陷，在報表上長得一模一樣。**
 */
const DISABLED_RE =
  /\b(it|test|describe)\s*\.\s*(todo|skip|fails)\s*\(\s*(['"`])([\s\S]*?)\3/

const TAG_RE = /^\s*\[(BLOCKED|UNSUPPORTED|TOMBSTONE|DEADSKIP|UNVERIFIED)(?::([^\]]+))?\]/

export function parseTag(title: string): Tag | null {
  const m = TAG_RE.exec(title)
  if (!m) return null
  const type = m[1] as TagType
  const value = m[2]?.trim()
  if (type === 'BLOCKED') return { type, blocker: value }
  if (type === 'UNSUPPORTED') return { type, wanted: value }
  if (type === 'TOMBSTONE') return { type, tombstoneRef: value }
  return { type }
}

/** 掃一個測試檔，找出所有被停用的項目 */
export function scanDisabledInFile(relPath: string): DisabledEntry[] {
  const src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
  const out: DisabledEntry[] = []
  src.split('\n').forEach((line, idx) => {
    const m = DISABLED_RE.exec(line)
    if (!m) return
    const [, fn, kind, , title] = m
    out.push({
      file: relPath,
      line: idx + 1,
      kind: kind as 'todo' | 'skip' | 'fails',
      scope: fn === 'describe' ? 'describe' : 'test',
      title,
      tag: parseTag(title),
      // 停用宣告的同一行有 `=>` 就代表後面接了 callback（有本體）
      hasBody: /=>/.test(line),
    })
  })
  return out
}

/**
 * **跨行寫的停用測試**——掃描逐行進行，所以這些是隱形的。
 *
 * ⚠️ 這是「量測工具會安靜地低報」的又一個實例，而它的特別之處是
 * **低報的方向是零**：一筆看不見的缺陷，與一筆不存在的缺陷，在報表上
 * 長得一模一樣。缺陷帳存在的唯一理由是讓優先序看得見，而看不見的那些
 * 不會排進任何優先序。
 *
 * 沒有這個函式的話，只要有人把 `it.skip(` 的標題換到下一行，那筆缺陷就
 * 從帳上消失——而**測試依然是綠的**。
 */
export function findMultilineDisabled(dirs: readonly string[]): { file: string; line: number }[] {
  const out: { file: string; line: number }[] = []
  const 開頭沒有標題 = /\b(it|test|describe)\s*\.\s*(todo|skip)\s*\(\s*$/
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(f)
        continue
      }
      if (!e.name.endsWith('.test.ts')) continue
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (開頭沒有標題.test(line)) out.push({ file: path.relative(REPO_ROOT, f), line: i + 1 })
      })
    }
  }
  for (const d of dirs) walk(path.join(REPO_ROOT, d))
  return out
}

/** 掃整個 tests/ 目錄 */
export function scanAllDisabled(): DisabledEntry[] {
  const out: DisabledEntry[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue
        walk(f)
        continue
      }
      if (!e.name.endsWith('.test.ts')) continue
      out.push(...scanDisabledInFile(path.relative(REPO_ROOT, f)))
    }
  }
  walk(path.join(REPO_ROOT, 'tests'))
  // ⚠️ **元件膠囊的自證測住在 `src/components/` 裡。**
  // 只掃 `tests/` 的話，一個寫在膠囊裡的 `[BLOCKED:]` 對缺陷帳是**隱形的**
  // ——而缺陷帳存在的唯一理由就是讓優先序看得見。
  // 一筆看不見的缺陷，與一筆不存在的缺陷，在報表上長得一模一樣。
  const 膠囊根 = path.join(REPO_ROOT, 'src/components')
  if (fs.existsSync(膠囊根)) walk(膠囊根)
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

/** 驗證 TOMBSTONE 參照指向真的存在的決策記錄與錨點 */
export function tombstoneRefExists(ref: string): boolean {
  const [file, anchor] = ref.split('#')
  if (!file) return false
  const abs = path.join(REPO_ROOT, 'knowledge/history', `${file}.md`)
  if (!fs.existsSync(abs)) return false
  if (!anchor) return true
  const content = fs.readFileSync(abs, 'utf8')
  // 錨點以 kebab 化的標題比對：把 markdown 標題正規化後找
  const headings = [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map(([, h]) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, ''),
  )
  const want = anchor.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '')
  return headings.includes(want)
}
