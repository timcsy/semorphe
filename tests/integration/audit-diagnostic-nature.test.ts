/**
 * **護欄：每一條診斷規則都標得出性質——形態、提示、判決**（vision〈形態檢查與判決的界線盤點〉的結束條件，2026-11-09）。
 *
 * 判準與每一條的歸類在 `src/core/diagnostic-nature.ts`。三支斷言回答不同的問題：
 * ① 文案裡有的規則（`DIAG_<規則>_BLOCK`）都有性質——加一條規則而忘了歸類 ⟹ 紅（硬性零）
 * ② 程式碼裡產得出的規則（`rule: 'X'` 與判決產出端 `VERDICT_RULES`）都有性質——繞過文案的也抓得到（硬性零）
 * ③ 判決產出端的規則一條都不准標成形態——「意思歸 Cella」：Cella 判的東西不是 semorphe 的形態檢查
 * ⚠️ 入口條件：掃到的規則數是合成量（50 以上）——掃描器壞了「全部都有性質」也會是綠的。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import { natureOf, NATURE_RULES } from '../../src/core/diagnostic-nature'
import { VERDICT_RULES } from '../../src/core/verdict-diagnostics'

const fromLabels = [...new Set(Object.keys(zhTW as Record<string, string>).filter((k) => /^DIAG_.+_BLOCK$/.test(k)).map((k) => k.slice(5, -'_BLOCK'.length)))]

function srcFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) srcFiles(p, acc)
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) acc.push(p)
  }
  return acc
}
const fromCode = [...new Set(srcFiles('src').flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/rule: '([A-Z_]+)'/g)].map((m) => m[1])))]

describe('護欄：診斷規則的性質（形態／提示／判決）', () => {
  it('★ 入口條件：掃到的規則數（文案 50 以上、程式碼 20 以上）', () => {
    expect(fromLabels.length).toBeGreaterThanOrEqual(50)
    expect(fromCode.length).toBeGreaterThanOrEqual(20)
  })
  it('🔴 硬性零：文案裡的每一條規則都有性質', () => {
    expect(fromLabels.filter((r) => !natureOf(r))).toEqual([])
  })
  it('🔴 硬性零：程式碼產得出的每一條規則（含判決產出端）都有性質', () => {
    expect([...fromCode, ...VERDICT_RULES].filter((r) => !natureOf(r))).toEqual([])
  })
  it('🔴 硬性零：判決產出端的規則不准標成形態（意思歸 Cella）', () => {
    expect(VERDICT_RULES.filter((r) => natureOf(r) === 'form')).toEqual([])
  })
  it('🔴 硬性零：提示不准以 error 呈現——形態檢查那側寫死嚴重度的規則（Cella 那側由 category 決定，提示類都對到 info）', () => {
    const fixedError = srcFiles('src').flatMap((f) => {
      const t = fs.readFileSync(f, 'utf8')
      return [...t.matchAll(/severity: 'error',\s*rule: '([A-Z_]+)'|rule: '([A-Z_]+)',\s*severity: 'error'/g)].map((m) => m[1] ?? m[2])
    })
    expect(fixedError.filter((r) => natureOf(r) === 'hint')).toEqual([])
  })
  it('★ 注入：一條沒歸類的規則會被抓到（這支護欄不是永遠綠）', () => {
    expect(natureOf('NOT_A_RULE_XYZ')).toBeUndefined()
    expect(NATURE_RULES.length).toBeGreaterThanOrEqual(fromLabels.length)
  })
})
