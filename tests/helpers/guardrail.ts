/**
 * 護欄共用形狀：量測 → 報表 → 與基線比對（棘輪）
 *
 * 四條護欄（中立性／完備性／缺陷帳／就近性）都是這個形狀。
 * 見 specs/049-audit-guardrails/data-model.md
 */
import fs from 'node:fs'
import path from 'node:path'

export const REPO_ROOT = path.resolve(__dirname, '../..')
const BASELINE_DIR = path.join(REPO_ROOT, 'tests/baselines')

export interface BaselineMeta {
  guard: string
  measuredAt: string
  /** 判定方式的一句話描述（FR-012／FR-042 要求記錄） */
  rule: string
  note: string
}

export const RATCHET_NOTE =
  '數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。'

/**
 * 載入基線。缺失時擲出可讀錯誤——第一次跑護欄本來就沒有基線，
 * 錯誤訊息要直接告訴維護者下一步做什麼。
 */
export function loadBaseline<T>(guard: string): T {
  const file = path.join(BASELINE_DIR, `${guard}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(
      `基線檔不存在：tests/baselines/${guard}.json\n` +
        `這是護欄第一次執行的正常狀態。請先跑一次量測產生基線並 commit，之後棘輪才會生效。\n` +
        `見 tests/baselines/README.md`,
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export function writeBaseline(guard: string, data: object): void {
  const file = path.join(BASELINE_DIR, `${guard}.json`)
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

/**
 * 棘輪比對：回傳**新增項的清單**，不是布林。
 *
 * FR-005 要求失敗時指名是哪一項使數字上升，所以比對粒度必須是項目而非總數。
 * 空陣列 = 通過。
 */
export function newItems<T>(current: readonly T[], baseline: readonly T[], key: (x: T) => string): T[] {
  const known = new Set(baseline.map(key))
  return current.filter((x) => !known.has(key(x)))
}

/** 有改善時提示可下調基線（不影響通過與否） */
export function fixedItems<T>(current: readonly T[], baseline: readonly T[], key: (x: T) => string): T[] {
  const now = new Set(current.map(key))
  return baseline.filter((x) => !now.has(key(x)))
}

/** 統一的報表輸出——護欄的產出是報表，不只是通過／失敗（FR-002） */
export function printReport(title: string, lines: string[]): void {
  const bar = '─'.repeat(Math.min(72, title.length + 4))
  console.log(`\n${bar}\n  ${title}\n${bar}`)
  for (const l of lines) console.log(l)
  console.log('')
}

/** 把報表同時寫成檔案（給補完地圖這類需要留存的產出） */
export function writeReport(relPath: string, content: string): void {
  const file = path.join(REPO_ROOT, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

/** 遞迴列出目錄下所有 .ts / .json 原始檔（跳過 node_modules 與 .d.ts） */
export function listSourceFiles(relDir: string, exts = ['.ts']): string[] {
  const abs = path.join(REPO_ROOT, relDir)
  if (!fs.existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue
        walk(f)
      } else if (exts.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.d.ts')) {
        out.push(path.relative(REPO_ROOT, f))
      }
    }
  }
  walk(abs)
  return out.sort()
}

/**
 * 棘輪：**兩個方向都要出聲**。
 *
 * ## 為什麼改善也要紅
 *
 * 棘輪只擋上升的話，它不會自己收緊。實際發生過：一個功能把「孤兒實作」從 4
 * 修到 1，**基線卻還寫著 4**——那等於默許它退回 4 而不會有人發現。
 *
 * 改善訊息每次都印，但沒有人會為了一行 stdout 去改檔案。**只有紅色會。**
 *
 * 下調基線是十秒鐘的事，而且本來就該與那次改善同一個 commit——
 * 「不准紅著過夜」講的是不要放著，不是不要紅。
 *
 * @param rows [名稱, 現值, 基線值][]
 */
export function assertRatchet(rows: readonly [string, number, number][]): void {
  const worse = rows.filter(([, now, base]) => now > base)
  const better = rows.filter(([, now, base]) => now < base)
  if (worse.length > 0) {
    throw new Error(
      '棘輪退步：\n' +
        worse.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`).join('\n'),
    )
  }
  if (better.length > 0) {
    throw new Error(
      '棘輪有改善，**請下調基線並與這次改善一起 commit**：\n' +
        better.map(([n, now, base]) => `  ✔ ${n}: ${base} → ${now}`).join('\n') +
        '\n（棘輪只擋上升的話不會自己收緊——舊基線會默許退回去而沒有人發現）',
    )
  }
}
