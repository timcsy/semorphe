/**
 * 就近性護欄（US4）
 *
 * 量：一個元件的實作散在幾個原始檔、幾個目錄。
 *
 * 這是 P3「系統可以在**不修改既有程式碼**的前提下加入新概念」的操作化。
 * 那條原則目前是假的——加一個元件要動十幾個檔。數字就是它有多假。
 *
 * 見 specs/049-audit-guardrails/spec.md（US4）
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
  assertRatchet,
} from '../helpers/guardrail'
import { allComponentIds, scanDirs } from '../helpers/component-scan'
import { classifyFile } from '../helpers/file-classification'

/** 就近性關心的是實作擴散，範圍是整個 src/（不只核心層） */
const SCAN_DIRS = ['src'] as const

const RULE =
  '只匹配完整的引號字串字面（\'id\' / "id" / `id`），與中立性護欄同一套規則。' +
  '掃 src/ 的 .ts 與 .json，但**只計「實作」類的檔**——' +
  '課程清單（topics/）與工具箱清單（toolbox-categories.ts）是登錄表的視圖，不是實作擴散。'

interface LocalityBaseline {
  _meta: BaselineMeta
  limits: Record<string, { files: number; dirs: number }>
}

interface Spread {
  componentId: string
  files: number
  dirs: number
  paths: string[]
}

function measure(): Spread[] {
  const ids = allComponentIds()
  const hits = scanDirs(SCAN_DIRS, ids, ['.ts', '.json'])

  const byId = new Map<string, string[]>()
  for (const [file, h] of hits) {
    // ⚠️ **清單不是實作。** 一顆元件出現在 `topics/cpp-beginner.json` 裡代表
    // 「這門課教它」，不代表「它的實作散到那裡去了」。前兩大共用檔各含 166／164
    // 顆元件，全部被算成擴散——那個數字量的是登錄表的視圖，不是碎裂。
    //
    // 分類與身分健檢護欄共用（`tests/helpers/file-classification.ts`），
    // 因為兩份判準會漂移。
    if (classifyFile(file) !== '實作') continue
    for (const id of h.code) {
      const arr = byId.get(id) ?? []
      arr.push(file)
      byId.set(id, arr)
    }
  }

  return ids
    .map((componentId) => {
      const paths = (byId.get(componentId) ?? []).sort()
      const dirs = new Set(paths.map((p) => path.dirname(p)))
      return { componentId, files: paths.length, dirs: dirs.size, paths }
    })
    .sort((a, b) => b.files - a.files || a.componentId.localeCompare(b.componentId))
}

describe('護欄：就近性（一個元件的實作散在幾個檔）', () => {
  const spreads = measure()

  it('產出可讀報表：擴散度排名', () => {
    const withHits = spreads.filter((s) => s.files > 0)
    const total = withHits.reduce((n, s) => n + s.files, 0)

    const lines: string[] = []
    lines.push(`判定規則：${RULE}`)
    lines.push('')
    lines.push(
      `有實作足跡的元件：${withHits.length} / ${spreads.length}｜` +
        `平均擴散：${(total / Math.max(1, withHits.length)).toFixed(1)} 檔`,
    )
    lines.push('')
    lines.push('最擴散的 15 個：')
    for (const s of withHits.slice(0, 15)) {
      lines.push(`  ${String(s.files).padStart(3)} 檔 / ${String(s.dirs).padStart(2)} 目錄   ${s.componentId}`)
    }

    const zero = spreads.filter((s) => s.files === 0)
    if (zero.length > 0) {
      lines.push('')
      lines.push(
        `⚠ 零足跡元件：${zero.length} 個——它們只出現在 JSON，程式碼裡沒有任何引用。` +
          `這通常代表純宣告式（走 pattern／template），但也可能是「殼」——由完備性護欄裁決。`,
      )
    }

    printReport('就近性護欄', lines)
    expect(withHits.length).toBeGreaterThan(0)
  })

  it('數字不為零——零代表沒有真的量到東西（SC-001）', () => {
    const target = spreads.find((s) => s.componentId === 'cpp:string_at')
    expect(target).toBeDefined()
    expect(target!.files).toBeGreaterThan(0)
  })

  it('棘輪：任一元件的擴散度不得超過其上限（FR-003、FR-005）', () => {
    const baseline = loadBaseline<LocalityBaseline>('locality')

    const worsened = spreads
      .filter((s) => {
        const lim = baseline.limits[s.componentId]
        if (!lim) return s.files > 0 // 基線沒記錄卻有足跡 = 新元件擴散了
        return s.files > lim.files || s.dirs > lim.dirs
      })
      .map((s) => {
        const lim = baseline.limits[s.componentId]
        return `  ✘ ${s.componentId}: ${s.files} 檔 / ${s.dirs} 目錄` +
          (lim ? `（上限 ${lim.files} / ${lim.dirs}）` : '（基線無此元件）')
      })

    const improved = spreads.filter((s) => {
      const lim = baseline.limits[s.componentId]
      return lim && (s.files < lim.files || s.dirs < lim.dirs)
    })

    if (improved.length > 0) {
      printReport(
        '就近性：有改善，可下調基線',
        improved
          .slice(0, 20)
          .map(
            (s) =>
              `  ✔ ${s.componentId}: ${s.files} 檔 / ${s.dirs} 目錄` +
              `（上限 ${baseline.limits[s.componentId].files} / ${baseline.limits[s.componentId].dirs}）`,
          ),
      )
    }

    if (worsened.length > 0) printReport('就近性：偵測到擴散惡化', worsened)

    expect(worsened).toEqual([])
    // 只擋上升的棘輪不會自己收緊——舊基線會默許退回去，而**綠色套件的輸出
    // 沒有人會讀**，所以「有改善」只印一行報表等於沒有發生。改善必須讓測試
    // 變紅，逼基線與改善一起 commit。
    assertRatchet([['擴散度低於上限的元件', 0, improved.length]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-locality.test.ts` */
if (process.env.GENERATE_BASELINE) {
  const limits: Record<string, { files: number; dirs: number }> = {}
  for (const s of measure()) {
    if (s.files > 0) limits[s.componentId] = { files: s.files, dirs: s.dirs }
  }
  writeBaseline('locality', {
    _meta: {
      guard: 'locality',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note:
        RATCHET_NOTE +
        ' 只記上限、不記路徑清單——路徑變動頻繁，記了 diff 會不可讀。' +
        ' ⚠️ 2026-08-07 全體大幅下降（175 顆），原因是**重新分類**而非實作變好：' +
        '課程清單（topics/）與工具箱清單改歸「清單」，不再計入實作擴散。' +
        '系統一行都沒有變得更集中——只是我們終於說清楚在量什麼。' +
        '（history/018：用宣告刷數字看起來會像進步，所以下降必須註記原因。）',
    },
    limits: Object.fromEntries(Object.entries(limits).sort(([a], [b]) => a.localeCompare(b))),
  })
}
