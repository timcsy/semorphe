/**
 * **護欄：讀基線檔的整合測試都要在 `npm run test:guard` 裡**（436，2026-11-13）。
 *
 * ## 🔴 它守的是一個重複了三次的洞
 *
 * `test:guard` 原本只是 `vitest run tests/integration/audit-`——用檔名挑。而有四支整合測試
 * **讀 `tests/baselines/` 的快照、卻不叫 `audit-`**（工具箱快照、搬家護欄、元件詞彙、宣告變動），
 * 於是「改宣告、身分、基線、工具箱 → 跑 test:guard」那一列的人跑完全綠，紅在半小時後的長測試：
 *
 * ```
 * 355（11-08）  工具箱快照          長測試抓到 → 重跑
 * 403（11-11）  工具箱快照          長測試抓到 → 再提交一次
 * 435（11-13）  工具箱快照＋搬家護欄 長測試抓到 → 再提交一次
 * ```
 *
 * > **一個用名字挑的子集，會漏掉做同一件事而名字不像的那幾支。**
 *
 * 所以這一支不問名字，問**它做的事**：讀了基線檔 ⟹ 要被 `test:guard` 涵蓋。
 *
 * ## ⚠️ 自我否證
 * 一支讀基線的非 audit 測試都找不到 ⟹ 偵測器壞了（★ 入口條件）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const DIR = path.join(ROOT, 'tests/integration')

/** 偵測器：這段測試原始碼讀不讀 `tests/baselines/` */
export function readsBaseline(src: string): boolean {
  return /tests\/baselines|baselines\//.test(src)
}

/** `test:guard` 的參數（vitest 的檔名過濾子） */
function guardFilters(): string[] {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const cmd = pkg.scripts['test:guard'] ?? ''
  return cmd.split(/\s+/).filter((a) => a.startsWith('tests/'))
}

describe('護欄：讀基線的整合測試都在 test:guard 裡', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.ts'))
  const reading = files.filter((f) => readsBaseline(fs.readFileSync(path.join(DIR, f), 'utf8')))
  const nonAudit = reading.filter((f) => !f.startsWith('audit-'))

  it('★ 注入：偵測器認得出合成的讀基線檔、放過不讀的', () => {
    expect(readsBaseline("path.join(REPO_ROOT, 'tests/baselines')")).toBe(true)
    expect(readsBaseline("import x from './helpers'")).toBe(false)
  })

  it('★ 入口條件：找得到不叫 audit- 的讀基線檔', () => {
    expect(nonAudit.length).toBeGreaterThan(0)
  })

  it('每一支讀基線的整合測試都被 test:guard 的過濾子涵蓋', () => {
    const filters = guardFilters()
    const missed = reading.filter((f) => !filters.some((flt) => `tests/integration/${f}`.includes(flt)))
    expect(missed, `這幾支讀基線卻不在 test:guard 裡——加進 package.json 的 test:guard：${missed.join('、')}`).toEqual([])
  })
})
