/**
 * 中立性護欄（US1）
 *
 * 量：核心與呈現層有幾個檔案硬編了特定語言的元件身分。
 *
 * 這是 P9「語言獨立性：拔掉 C++，只裝 Python stub → 所有視圖仍啟動，
 * 無 languages/cpp/ import」的執行機構——那條原則寫在 principles.md，
 * 但在本護欄之前**沒有任何測試在檢查它**。
 *
 * 數字是幾，就是離語言獨立性還有多遠。
 *
 * 見 specs/049-audit-guardrails/spec.md（US1）、knowledge/concepts/執行機構.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  newItems,
  fixedItems,
  RATCHET_NOTE,
  type BaselineMeta,
  listSourceFiles,
  REPO_ROOT,
} from '../helpers/guardrail'
import { languageSpecificComponentIds, universalComponentIds, scanDirs, splitCodeAndComments } from '../helpers/component-scan'

/** 掃描範圍：核心與呈現層。這些地方不該認得任何特定語言的元件。 */
const NEUTRAL_DIRS = ['src/core', 'src/ui', 'src/interpreter', 'src/views'] as const

const RULE =
  '只匹配完整的引號字串字面（\'id\' / "id" / `id`）。僅計語言專屬概念（lang-core／lang-library）；' +
  'universal 概念拔掉 C++ 後依然存在，不妨礙 P9，改由就近性護欄涵蓋。註解中的引用另計、不入基線。'

interface NeutralityBaseline {
  _meta: BaselineMeta
  total: number
  files: Record<string, string[]>
}

interface Violation {
  file: string
  componentId: string
  lines: number[]
}

function measure(): {
  violations: Violation[]
  commentOnly: Map<string, string[]>
  universalHits: number
} {
  const ids = languageSpecificComponentIds()
  const hits = scanDirs(NEUTRAL_DIRS, ids)
  const universalHits = [...scanDirs(NEUTRAL_DIRS, universalComponentIds()).values()].reduce(
    (n, h) => n + h.code.length,
    0,
  )

  const violations: Violation[] = []
  const commentOnly = new Map<string, string[]>()

  for (const [file, h] of [...hits].sort(([a], [b]) => a.localeCompare(b))) {
    for (const id of h.code) violations.push({ file, componentId: id, lines: h.lines[id] ?? [] })
    if (h.commentOnly.length > 0) commentOnly.set(file, h.commentOnly)
  }
  return { violations, commentOnly, universalHits }
}

const key = (v: Violation): string => `${v.file}::${v.componentId}`

// ─────────────────────────────────────────────────────────────────────
// P9 的原文是「拔掉 C++ 之後，核心**無 `languages/cpp/` import**」。
// 本護欄原本只數**概念身分字串**——一個核心檔直接 import 語言套件，它
// 一個字都看不到。那是這條原則自己寫下的檢查，卻從來沒被做過。
// 見 specs/055-finish-executor-move
// ─────────────────────────────────────────────────────────────────────
function coreImportsOfLanguagePackages(): { file: string; spec: string }[] {
  const out: { file: string; spec: string }[] = []
  for (const rel of [...listSourceFiles('src/core'), ...listSourceFiles('src/interpreter')]) {
    // **只看程式碼，不看註解**——本檔的概念身分掃描早就在做這件事了，
    // 而這條新檢查第一版忘了套用，於是把一句解釋 P9 的註解報成違規。
    const { code } = splitCodeAndComments(readFileSync(join(REPO_ROOT, rel), 'utf8'))
    for (const m of code.matchAll(/from\s+'([^']*languages\/[^']+)'/g)) {
      out.push({ file: rel, spec: m[1] })
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file))
}

const languageImports = coreImportsOfLanguagePackages()

describe('護欄：核心不得 import 語言套件（P9 的字面要求）', () => {
  it('★ 這是 P9 原文寫的檢查——概念身分掃描看不到它', () => {
    printReport('核心 → 語言套件的 import', [
      '⚠️ 這條與概念身分掃描是**兩種東西**。一個核心檔可以一個 C++ 概念名都不提，',
      '   卻直接 import 整個語言套件——那時身分掃描是乾淨的，而 P9 已經破了。',
      '',
      `目前：${languageImports.length} 處`,
      ...languageImports.map((x) => `  ${x.file} → ${x.spec}`),
    ])
    expect(
      languageImports.map((x) => `${x.file} → ${x.spec}`),
      '核心層直接 import 了語言套件。拔掉 C++ 之後這裡會編不過——' +
        'P9 的原文就是在講這件事。',
    ).toEqual([])
  })
})

describe('護欄：中立性（kernel／app／render 不得認得特定語言的元件身分）', () => {
  const { violations, commentOnly, universalHits } = measure()
  const files = [...new Set(violations.map((v) => v.file))]

  it('產出可讀報表：違規檔案 × 元件身分 × 行號', () => {
    const lines: string[] = []
    lines.push(`判定規則：${RULE}`)
    lines.push(`掃描範圍：${NEUTRAL_DIRS.join('、')}`)
    lines.push('')
    lines.push(`違規檔案：${files.length} 個｜違規項目：${violations.length} 筆`)
    lines.push('')

    for (const f of files) {
      const own = violations.filter((v) => v.file === f)
      lines.push(`  ${f}`)
      for (const v of own) lines.push(`      ${v.componentId}  @ 行 ${v.lines.join(', ')}`)
    }

    lines.push('')
    lines.push(
      `（參考｜不計入本護欄）universal 概念在同範圍的引用：${universalHits} 筆——` +
        `它們拔掉 C++ 後依然存在，屬碎裂而非語言耦合，由就近性護欄涵蓋。`,
    )

    if (commentOnly.size > 0) {
      lines.push('')
      lines.push('僅出現在註解（不計入基線——說明不是耦合）：')
      for (const [f, ids] of commentOnly) lines.push(`  ${f}  →  ${ids.join(', ')}`)
    }

    printReport('中立性護欄', lines)

    // 報表本身一定產得出來；數字大小由下面的棘輪管
    expect(files.length).toBeGreaterThanOrEqual(0)
  })

  it('數字不為零——零代表沒有真的量到東西（SC-001）', () => {
    // 存量已知為正。哪天真的歸零了，這條會提醒你把整條護欄的意義重新定位。
    expect(violations.length).toBeGreaterThan(0)
  })

  it('棘輪：不得出現基線之外的新違規（FR-003、FR-005）', () => {
    const baseline = loadBaseline<NeutralityBaseline>('neutrality')
    const known: Violation[] = Object.entries(baseline.files).flatMap(([file, ids]) =>
      ids.map((componentId) => ({ file, componentId, lines: [] })),
    )

    const added = newItems(violations, known, key)
    const removed = fixedItems(violations, known, key)

    if (removed.length > 0) {
      printReport(
        '中立性：有改善，可下調基線',
        removed.map((v) => `  ✔ 已清除  ${v.file}  →  ${v.componentId}`),
      )
    }

    if (added.length > 0) {
      printReport(
        '中立性：偵測到新違規',
        added.map((v) => `  ✘ 新增  ${v.file}  →  ${v.componentId}  @ 行 ${v.lines.join(', ')}`),
      )
    }

    // FR-005：失敗時指名是哪一項，而不只是總數變了
    expect(added.map(key)).toEqual([])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-neutrality.test.ts` */
if (process.env.GENERATE_BASELINE) {
  const { violations } = measure()
  const files: Record<string, string[]> = {}
  for (const v of violations) (files[v.file] ??= []).push(v.componentId)
  for (const k of Object.keys(files)) files[k].sort()

  writeBaseline('neutrality', {
    _meta: {
      guard: 'neutrality',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE,
    },
    total: Object.keys(files).length,
    files,
  })
}
