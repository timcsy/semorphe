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
  assertRatchet,
} from '../helpers/guardrail'
import neutralityBaseline from '../baselines/neutrality.json'
import { allComponentIds, allComponentBlockTypes, languageImportsIn, COMPOSITION_ROOT, scanDirs, scanText, splitCodeAndComments } from '../helpers/component-scan'

/** 掃描範圍：核心與呈現層。這些地方不該認得任何特定語言的元件。 */
const NEUTRAL_DIRS = ['src/core', 'src/ui', 'src/interpreter', 'src/views'] as const

const RULE =
  '只匹配完整的引號字串字面（\'id\' / "id" / `id`），但**先遮掉拼法像身分、實際不是**的位置' +
  '（型別位置的聯集成員、Blockly 欄位的預設值）——判不出來一律留著算違規。' +
  '計入【全部】元件身分——spec 152 拿掉了舊的 `universal` 豁免（它的理由' +
  '「拔掉 C++ 後依然存在」是假的：元件全是 `cpp:` scope）。註解中的引用另計、不入基線。' +
  '\n⚠️ 而這一維只掃【概念身分】（`cpp:print`）——【積木型別】（`cpp_print`）另一維，見下。'

const NOT_DETECTED =
  '本護欄**不檢測「語法層級」的語言耦合**——它找的是元件身分字串，不是語法。' +
  '`src/core/lift/lifter.ts` 在核心層剝 `//` 與區塊註解符號，那是比帳面上更嚴重的耦合，' +
  '而這條護欄一個字都看不到。**身分只是耦合的一種形式。**' +
  '另不檢測：核心 import 語言套件（另有一支測試看）、執行期才成立的耦合。'

const SELF_FALSIFICATION =
  '⚠️ 這條護欄的健康檢查是 `tests/unit/helpers/mask-non-identity.test.ts` 的**雙向注入**，' +
  '**不是報表上的數字**。遮罩若濾掉真違規，數字會一路好看地降到 0，而報表長得一模一樣。' +
  '那組測試錨在合成字串上，不隨真實檔案被修好而失效。'

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
  /** 🔴 spec 153 新增的第二維：中立範圍裡硬編的【積木型別】。 */
  blockTypeHits: { file: string; count: number }[]
  /** 🔴 spec 155 新增的第三維：中立範圍裡**真正 import 語言套件**的地方。 */
  languageImports: { file: string; spec: string }[]
} {
  // 🔄 **spec 152：計入【全部】元件身分。**
  //    舊版只計 lang-core／lang-library，而豁免 universal 的理由
  //    「拔掉 C++ 後依然存在」**是假的**——233 顆元件全是 `cpp:` scope。
  //    🟢 動它的時機是「它豁免了 0 筆」的今天：沒有數字要調。
  const ids = allComponentIds()
  const hits = scanDirs(NEUTRAL_DIRS, ids)

  // 🔴 **第二維：積木型別**（spec 153）。
  //    第一維掃的是概念身分（`cpp:print`），而中立範圍裡硬編的是
  //    積木型別（`cpp_print`）——於是 44 筆耦合對第一維【不存在】。
  //    ⚠️ **兩個數字必須一起看**：把 `block-registrar` 的常數搬進 `core/`
  //    會讓第一維降、第二維升，而只看第一維會把它當成進步。
  const blockTypeHits = [...scanDirs(NEUTRAL_DIRS, allComponentBlockTypes())]
    .map(([file, h]) => ({ file, count: h.code.length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => a.file.localeCompare(b.file))

  const violations: Violation[] = []
  const commentOnly = new Map<string, string[]>()

  for (const [file, h] of [...hits].sort(([a], [b]) => a.localeCompare(b))) {
    for (const id of h.code) violations.push({ file, componentId: id, lines: h.lines[id] ?? [] })
    if (h.commentOnly.length > 0) commentOnly.set(file, h.commentOnly)
  }
  return { violations, commentOnly, blockTypeHits, languageImports: languageImportsIn(NEUTRAL_DIRS) }
}

const key = (v: Violation): string => `${v.file}::${v.componentId}`

/**
 * 逐筆歸因：這一筆是「誤報修掉的」還是「真的搬走的」？
 *
 * 判準**不是猜的**，是查 `specs/059-concept-id-vs-lookalike/baseline-29.txt`
 * 那份快照——它在動任何東西之前拍下，是全程唯一的歸因依據。
 * 名單寫死在這裡，因為它記錄的是**一次歷史事件**，不是會漂移的狀態。
 */
const falsePositiveList = [
  'src/core/types.ts::comment',            // Annotation 介面的聯集成員
  'src/ui/block-registrar.ts::comment',    // Blockly 欄位的預設值（使用者看到的提示文字）
] as const

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
  const { violations, commentOnly, blockTypeHits, languageImports } = measure()
  const files = [...new Set(violations.map((v) => v.file))]

  // 兩欄歸因：拿 059 動工前拍的 29 筆快照當基準，逐筆判斷它為什麼不見了
  const beforeWork = readFileSync(join(REPO_ROOT, 'specs/059-concept-id-vs-lookalike/baseline-29.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('::') && !l.startsWith('#'))
  const present = new Set(violations.map(key))
  const gone = beforeWork.filter((k) => !present.has(k))
  const fixedFalsePositives = gone.filter((k) => (falsePositiveList as readonly string[]).includes(k))
  const actuallyMoved = gone.filter((k) => !(falsePositiveList as readonly string[]).includes(k))

  it('🔴 第三維（import）——P9 原文就寫著「無 languages/cpp import」', () => {
    // ⚠️ 組裝點豁免，而豁免印在報表上（見報表那一支）。
    expect(languageImports.map((x) => `${x.file} → ${x.spec}`),
      '中立層 import 了語言套件。**前兩維看不到這種耦合**——它們掃的是字串字面。')
      .toEqual([])
  })

  it('🔴 第二維（積木型別）只准下降', () => {
    // 🟢 **它不是紅燈，是基線**：44 筆在 2026-08-20 之前對這條護欄不存在。
    // ⚠️ 而它與①**必須一起看**——把 `block-registrar` 的常數搬進 `core/`
    //    會讓①降、②升，只看①會把搬家當成清償。
    const btTotal = blockTypeHits.reduce((n, x) => n + x.count, 0)
    const base = neutralityBaseline.blockTypes.total
    expect(btTotal,
      `積木型別耦合從 ${base} 升到 ${btTotal}——中立層【多】認得了語言專屬的積木型別`)
      .toBeLessThanOrEqual(base)
  })

  it('產出可讀報表：違規檔案 × 元件身分 × 行號', () => {
    const lines: string[] = []
    lines.push(SELF_FALSIFICATION)
    lines.push(NOT_DETECTED)
    lines.push('')
    lines.push(`判定規則：${RULE}`)
    lines.push(`掃描範圍：${NEUTRAL_DIRS.join('、')}`)
    lines.push('')
    lines.push(`① 概念身分（\`cpp:print\`）：違規檔案 ${files.length} 個｜違規項目 ${violations.length} 筆`)
    lines.push('')
    // 🔴 **第二維（spec 153）——兩個數字必須一起印。**
    //    只印第一個的話，「把常數搬進 core」會顯示成進步。
    const btTotal = blockTypeHits.reduce((n, x) => n + x.count, 0)
    lines.push(`② 積木型別（\`cpp_print\`）：${btTotal} 筆（Baseline ${neutralityBaseline.blockTypes.total}）`)
    lines.push('   ⚠️ **這一維在 2026-08-20 之前對護欄【不存在】**——它只掃了①。')
    for (const x of blockTypeHits) lines.push(`     ✘ ${x.file}：${x.count} 筆`)
    lines.push('')
    // 🔴 **第三維（spec 155）——三個數字必須一起印。**
    lines.push(`③ import 語言套件：${languageImports.length} 處（硬性零）`)
    lines.push(`   ⚠️ 組裝點 ${COMPOSITION_ROOT} 明確豁免——它知道自己裝了什麼是正常的。`)
    for (const x of languageImports) lines.push(`     ✘ ${x.file} → ${x.spec}`)
    lines.push('')

    // ── 兩欄歸因（FR-005）
    //
    // 「因為修了量測而消失的」與「因為真的搬走而消失的」**不得相加後只報總數**。
    // 混在一起的話，修量測會看起來像進步——而護欄會替它背書。
    // 這是 knowledge/history/018 的直接處方。
    lines.push('下降的歸因（本護欄的數字下降有兩種來源，意義完全不同）：')
    lines.push(`  誤報修掉的：${fixedFalsePositives.length} 筆 ← **系統沒有變**，只是量測不再把撞名字串當身分`)
    for (const k of fixedFalsePositives) lines.push(`      · ${k}`)
    lines.push(`  真的搬走的：${actuallyMoved.length} 筆 ← **系統變了**，那段語言知識離開了核心層`)
    for (const k of actuallyMoved) lines.push(`      · ${k}`)
    lines.push('')

    for (const f of files) {
      const own = violations.filter((v) => v.file === f)
      lines.push(`  ${f}`)
      for (const v of own) lines.push(`      ${v.componentId}  @ 行 ${v.lines.join(', ')}`)
    }

    lines.push('')
    lines.push(
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

  // ─────────────────────────────────────────────────────────────────
  // 這裡原本是「數字不為零——零代表沒有真的量到東西」，附註：
  //
  //   「存量已知為正。哪天真的歸零了，這條會提醒你把整條護欄的意義重新定位。」
  //
  // **2026-08-06：它歸零了，而那句提醒發揮了作用。** 重新定位有兩件事：
  //
  // ① 健康檢查改成**合成注入**。用「真實存量為正」當健康訊號，在存量真的
  //    清完的那天就會失效——那是這個專案本週學到的（`history/022`：
  //    「護欄修好了它要量的東西，就是它的錨點爛掉的時候」）。
  //
  // ② **零不等於語言獨立性成立。** 這條護欄只量得到耦合的**一種形式**
  //    ——元件身分。核心層寫死語法符號、直接 import 語言套件（另有一支在看）、
  //    執行期才成立的耦合，它都看不見。見 `history/021`。
  // ─────────────────────────────────────────────────────────────────
  it('★ 合成注入：一段含語言專屬身分的程式碼必須被報出（零才可信）', () => {
    const ids = allComponentIds()
    expect(ids.length, '語言專屬概念清單是空的 → 掃什麼都不會有結果').toBeGreaterThan(10)
    const probe = ids[0]
    const hits = scanText(`const x = generators.get('${probe}')`, ids)
    expect(
      hits.code,
      `合成注入沒被報出來 → 掃描壞了。**這時報表上的「0 筆」是假的**，` +
        '而它與健康的 0 長得一模一樣。',
    ).toContain(probe)
  })

  it('★ 合成注入：不含任何身分的程式碼不得被報出', () => {
    const hits = scanText('const x = 1 + 2', allComponentIds())
    expect(hits.code, '什麼都報的掃描器也會通過上一支').toEqual([])
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
    // 只擋上升的棘輪不會自己收緊——舊基線會默許退回去，而**綠色套件的輸出
    // 沒有人會讀**，所以「有改善」只印一行報表等於沒有發生。改善必須讓測試
    // 變紅，逼基線與改善一起 commit。
    assertRatchet([['違規項目', violations.length, known.length]])
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
