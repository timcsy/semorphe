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
  kind: 'todo' | 'skip'
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

/** `it.todo('...')` / `it.skip('...')` / `describe.skip('...')` / `test.todo(...)` */
const DISABLED_RE =
  /\b(it|test|describe)\s*\.\s*(todo|skip)\s*\(\s*(['"`])([\s\S]*?)\3/

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
      kind: kind as 'todo' | 'skip',
      scope: fn === 'describe' ? 'describe' : 'test',
      title,
      tag: parseTag(title),
      // 停用宣告的同一行有 `=>` 就代表後面接了 callback（有本體）
      hasBody: /=>/.test(line),
    })
  })
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
