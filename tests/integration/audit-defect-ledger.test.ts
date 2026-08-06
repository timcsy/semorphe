/**
 * 缺陷帳護欄（US3）
 *
 * 讓被歸檔的缺陷重新可見，並讓「修一個解鎖多個」的優先序第一次能被回答。
 *
 * 這是使用者連續三次要求的「發現 bug 就修、不能只留 it.todo；零 todo 為目標」
 * 的執行機構。那條規則已經寫進四支 skill，但沒有任何東西在檢查——所以
 * 存量一直在。
 *
 * 停用測試分三類，混在一起就沒有優先序可言：
 *   [BLOCKED:x]   缺陷，被元件 x 擋住      → 要修，且修 x 可能解鎖一批
 *   [TOMBSTONE:r] 已否決決定的正確後果      → **對的**，不該修
 *   [DEADSKIP]    已修好卻沒開回來          → 白白損失覆蓋
 *
 * 見 specs/049-audit-guardrails/spec.md（US3）
 */
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
} from '../helpers/guardrail'
import { scanAllDisabled, tombstoneRefExists, type DisabledEntry } from '../helpers/disabled-scan'
import { allComponentIds } from '../helpers/component-scan'

const RULE =
  '掃 tests/**/*.test.ts 的 it.todo／it.skip／describe.skip。' +
  '標記寫在標題開頭：[BLOCKED:id]（修既有元件）／[UNSUPPORTED:描述]（加新概念）／' +
  '[TOMBSTONE:檔名#錨點]（已否決決定的正確後果）／[DEADSKIP]（已修好沒開回來）。'

interface DefectBaseline {
  _meta: BaselineMeta
  total: number
  byBlocker: Record<string, number>
}

const entries: DisabledEntry[] = scanAllDisabled()
const knownIds = new Set(allComponentIds())

const unclassified = entries.filter((e) => e.tag === null)
const badBlocker = entries.filter(
  (e) => e.tag?.type === 'BLOCKED' && (!e.tag.blocker || !knownIds.has(e.tag.blocker)),
)
const badUnsupported = entries.filter((e) => e.tag?.type === 'UNSUPPORTED' && !e.tag.wanted)
const badTombstone = entries.filter(
  (e) => e.tag?.type === 'TOMBSTONE' && (!e.tag.tombstoneRef || !tombstoneRefExists(e.tag.tombstoneRef)),
)

function byBlocker(): Record<string, number> {
  const m: Record<string, number> = {}
  for (const e of entries) {
    if (e.tag?.type === 'BLOCKED' && e.tag.blocker) m[e.tag.blocker] = (m[e.tag.blocker] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(m).sort(([, a], [, b]) => b - a))
}

describe('護欄：缺陷帳（停用測試的分類與阻斷者）', () => {
  it('產出可讀報表：按阻斷者彙總，讓「修一個解鎖多個」可見（FR-034）', () => {
    const blockers = byBlocker()
    const counts = {
      BLOCKED: entries.filter((e) => e.tag?.type === 'BLOCKED').length,
      UNSUPPORTED: entries.filter((e) => e.tag?.type === 'UNSUPPORTED').length,
      TOMBSTONE: entries.filter((e) => e.tag?.type === 'TOMBSTONE').length,
      DEADSKIP: entries.filter((e) => e.tag?.type === 'DEADSKIP').length,
      未分類: unclassified.length,
    }

    const lines: string[] = []
    lines.push(`判定規則：${RULE}`)
    lines.push('')
    lines.push(
      `停用項目：${entries.length} 筆` +
        `（todo ${entries.filter((e) => e.kind === 'todo').length}｜` +
        `skip ${entries.filter((e) => e.kind === 'skip').length}；` +
        `其中 describe 區塊 ${entries.filter((e) => e.scope === 'describe').length} 個——一個區塊會蓋掉多個測試）`,
    )
    lines.push('')
    lines.push('分類：')
    for (const [k, v] of Object.entries(counts)) lines.push(`  ${k.padEnd(10)} ${v}`)
    lines.push('')
    const unsup = entries.filter((e) => e.tag?.type === 'UNSUPPORTED')
    if (unsup.length > 0) {
      lines.push('')
      lines.push('被「還不存在的概念」擋住（要加，不是修）：')
      for (const e of unsup) lines.push(`  ${e.tag?.wanted}  ← ${e.file}:${e.line}`)
    }
    lines.push('')
    lines.push('按阻斷者彙總（修上面的解鎖下面的數量）：')
    for (const [id, n] of Object.entries(blockers)) lines.push(`  ${String(n).padStart(3)}  ${id}`)

    if (unclassified.length > 0) {
      lines.push('')
      lines.push('未分類（護欄會因此失敗）：')
      for (const e of unclassified.slice(0, 30)) {
        lines.push(`  ${e.file}:${e.line}  ${e.title.slice(0, 60)}`)
      }
      if (unclassified.length > 30) lines.push(`  … 另外 ${unclassified.length - 30} 筆`)
    }

    printReport('缺陷帳護欄', lines)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('每一個停用測試都必須帶分類標記（FR-033）', () => {
    expect(unclassified.map((e) => `${e.file}:${e.line}`)).toEqual([])
  })

  it('[BLOCKED] 必須標明存在於註冊表的阻斷者（FR-031）', () => {
    expect(badBlocker.map((e) => `${e.file}:${e.line} → ${e.tag?.blocker ?? '(缺)'}`)).toEqual([])
  })

  it('[UNSUPPORTED] 必須寫明缺的是什麼概念', () => {
    expect(badUnsupported.map((e) => `${e.file}:${e.line}`)).toEqual([])
  })

  it('[TOMBSTONE] 必須連到真的存在的決策記錄與錨點（FR-032）', () => {
    expect(badTombstone.map((e) => `${e.file}:${e.line} → ${e.tag?.tombstoneRef ?? '(缺)'}`)).toEqual([])
  })

  it('棘輪：停用項目總數不得上升（FR-003）', () => {
    const baseline = loadBaseline<DefectBaseline>('defect-ledger')
    if (entries.length < baseline.total) {
      printReport('缺陷帳：有改善，可下調基線', [
        `  ✔ ${baseline.total} → ${entries.length}（少了 ${baseline.total - entries.length} 筆）`,
      ])
    }
    expect(entries.length).toBeLessThanOrEqual(baseline.total)
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-defect-ledger.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('defect-ledger', {
    _meta: {
      guard: 'defect-ledger',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE,
    },
    total: entries.length,
    byBlocker: byBlocker(),
  })
}
