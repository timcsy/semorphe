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
  assertRatchet,
  listSourceFiles,
} from '../helpers/guardrail'
import { findMultilineDisabled, scanAllDisabled, tombstoneRefExists, type DisabledEntry } from '../helpers/disabled-scan'
import { allComponentIds } from '../helpers/component-scan'

const RULE =
  '掃 tests/**/*.test.ts 的 it.todo／it.skip／describe.skip。' +
  '標記寫在標題開頭：[BLOCKED:id]（修既有元件）／[UNSUPPORTED:描述]（加新概念）／' +
  '[TOMBSTONE:檔名#錨點]（已否決決定的正確後果）／[DEADSKIP]（已修好沒開回來）。'

interface DefectBaseline {
  _meta: BaselineMeta
  total: number
  /** 真的測試，被關掉了——修好缺口就能開回來 */
  withBody: number
  /** 只有名字，測試程式從未存在——要讓它變真的得重新產生 */
  titleOnly: number
  /** 「不知道為什麼停用」的數量，只准下降，避免變成新垃圾桶 */
  unverified: number
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

const withBody = entries.filter((e) => e.hasBody)
const titleOnly = entries.filter((e) => !e.hasBody)
const unverified = entries.filter((e) => e.tag?.type === 'UNVERIFIED')

/**
 * 「修這個元件可以解鎖幾個測試」。
 *
 * **只統計有測試本體的項目**——只有名字的那些，修好缺口也不會「解鎖」任何
 * 東西，它們需要的是重新產生測試。把它們算進去會讓優先序失真，而優先序是
 * 這份彙總存在的唯一理由。（研究 F6：先前的版本把兩者混在一起數，
 * 「修 print 解鎖 21 個測試」是假的——那 21 個不存在。）
 */
function byBlocker(): Record<string, number> {
  const m: Record<string, number> = {}
  for (const e of withBody) {
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
      unclassified: unclassified.length,
    }

    const lines: string[] = []
    lines.push(`判定規則：${RULE}`)
    lines.push('')
    lines.push(
      `停用項目：${entries.length} 筆` +
        `（todo ${entries.filter((e) => e.kind === 'todo').length}｜` +
        `skip ${entries.filter((e) => e.kind === 'skip').length}｜` +
        `fails ${entries.filter((e) => e.kind === 'fails').length}；` +
        `其中 describe 區塊 ${entries.filter((e) => e.scope === 'describe').length} 個——一個區塊會蓋掉多個測試）`,
    )
    lines.push('')
    lines.push('**兩種東西，需要完全不同的工作**：')
    lines.push(`  有測試本體  ${String(withBody.length).padStart(3)}  ← 真的測試被關掉了，修好缺口就能開回來`)
    lines.push(`  只有名字    ${String(titleOnly.length).padStart(3)}  ← 測試程式從未存在，要讓它變真的得**重新產生**`)
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
    lines.push('按阻斷者彙總（修上面的解鎖下面的數量）——**只算有測試本體的**：')
    if (Object.keys(blockers).length === 0) {
      lines.push('  （無——目前所有 BLOCKED 都是「只有名字」，修缺口不會解鎖任何既有測試）')
    }
    for (const [id, n] of Object.entries(blockers)) lines.push(`  ${String(n).padStart(3)}  ${id}`)
    if (unverified.length > 0) {
      lines.push('')
      lines.push(`歸因待確認：${unverified.length} 筆——先前的標記來自檔案層級推測，不可信`)
    }

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

  it('報表分辨「被關掉的測試」與「只有名字的測試」（FR-020）', () => {
    // ⚠️ 這兩個分類必須**加起來等於總數**——那是分類器的不變式，
    // 不隨清償而失效。
    expect(withBody.length + titleOnly.length).toBe(entries.length)

    // ⚠️ **原本這裡是 `withBody > 0` 與 `titleOnly > 0`**，理由是「應該有」。
    // 而這條護欄的目標寫在 vision 裡：**停用測試 85 → 1**。
    // 也就是說，**它成功的那天這兩支就會紅**——錨在缺陷還在不在上面。
    //
    // 判準：斷言的那個數字，是不是這條護欄想推向零的？是 → 錨錯了。
    // 改錨在**掃描規模**上——測試檔的數量不會因為清償而歸零。
    const scannedTestFiles = listSourceFiles('tests').filter((f) => f.endsWith('.test.ts')).length
    expect(scannedTestFiles, '一個測試檔都沒掃到 → 報表上的每個數字都是假的').toBeGreaterThan(50)
  })

  it('棘輪：三個數字皆不得上升（FR-003、FR-023）', () => {
    const baseline = loadBaseline<DefectBaseline>('defect-ledger')
    const rows: [string, number, number][] = [
      ['總數', entries.length, baseline.total],
      ['有測試本體', withBody.length, baseline.withBody],
      ['只有名字', titleOnly.length, baseline.titleOnly],
      ['歸因待確認', unverified.length, baseline.unverified],
    ]
    const worsened = rows.filter(([, now, base]) => now > base)
    const improved = rows.filter(([, now, base]) => now < base)

    if (improved.length > 0) {
      printReport(
        '缺陷帳：有改善，可下調基線',
        improved.map(([n, now, base]) => `  ✔ ${n}: ${base} → ${now}`),
      )
    }
    if (worsened.length > 0) {
      printReport(
        '缺陷帳：數字上升',
        worsened.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`),
      )
    }
    // 只擋上升的棘輪不會自己收緊——舊基線會默許退回去，而**綠色套件的輸出
    // 沒有人會讀**，所以「有改善」只印一行報表等於沒有發生。改善必須讓測試
    // 變紅，逼基線與改善一起 commit。
    assertRatchet(rows)
  })

  it('★ 沒有跨行寫的停用測試——那種寫法對這本帳是隱形的', () => {
    // ⚠️ 掃描是**逐行**的（`hasBody` 靠同一行有沒有 `=>` 判斷）。把標題換到下一行，
    // 那筆缺陷就從帳上消失，**而測試依然是綠的**。
    //
    // 低報的方向是**零**，而那是最糟的方向：**一筆看不見的缺陷，與一筆不存在的
    // 缺陷，在報表上長得一模一樣。** 缺陷帳存在的唯一理由是讓優先序看得見。
    //
    // ⚠️ **這條訊息不得寫出停用宣告的字面**（函式名 ＋ 點 ＋ skip ＋ 左括號 ＋ 引號）
    // ——掃描會把它算成一筆真的停用測試。第一版就是這樣把自己多算了兩筆。
    //
    // （2026-08-10：寫元件膠囊的自證測時真的踩到——那筆 `[BLOCKED:]` 一開始
    // 寫成跨行，帳上完全沒有出現，而全套是綠的。）
    const invisible = findMultilineDisabled(['tests', 'src/components'])
    expect(
      invisible.map((x) => `${x.file}:${x.line}`),
      '停用宣告的標題與 callback 要寫回同一行——不然這筆缺陷對缺陷帳是隱形的',
    ).toEqual([])
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
    withBody: withBody.length,
    titleOnly: titleOnly.length,
    unverified: unverified.length,
    byBlocker: byBlocker(),
  })
}
