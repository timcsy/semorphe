/**
 * 語法耦合護欄（第九條）
 *
 * 量：核心與呈現層有幾處**寫死了特定語言的語法記號**。
 *
 * ## 為什麼中立性護欄不夠
 *
 * 中立性護欄量的是**元件身分字串**，而它今天歸零了（216 → 0）。
 *
 * **但那不代表 P9 成立。** 清償途中發現核心層還有六處寫死 C 家族的註解語法
 * ——產生 `//`、`/** *​/`、`/* *​/`，行末標註，兩處認不得概念的退路，以及從
 * 原始碼**剝掉**它們的規則。中立性護欄**一筆都數不到**，因為那六處一個元件
 * 身分都沒有。
 *
 * > 「一條規範被機械化時，**選了哪一維會消失在數字裡**。」
 * > ——`knowledge/concepts/執行機構.md`
 *
 * P9 的原文（`principles.md:115`）也只寫了一個維度：「無 `languages/cpp/`
 * import」。**import 是一種形式，身分是另一種，語法是第三種。**
 *
 * 這條護欄補的是第三種。見 `knowledge/history/021`。
 *
 * ## 判定保守：三個桶
 *
 * 確定 ／ **無法確定**（同形於核心自己的東西，例如 `'int'` 既是 C++ 型別也是
 * 核心的執行期型別標籤）／ 乾淨。**無法確定單獨報，不計入安全。**
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
  listSourceFiles,
  REPO_ROOT,
  assertRatchet,
} from '../helpers/guardrail'
import { splitCodeAndComments, maskNonIdentityPositions } from '../helpers/component-scan'
import { scanSyntaxTokens, DEFINITE_TOKENS, REGEX_ESCAPED_TOKENS } from '../helpers/syntax-tokens'

const SCAN_DIRS = ['src/core', 'src/ui', 'src/interpreter', 'src/views'] as const

const RULE =
  '掃字串字面與正則字面裡的語言專屬語法記號（前置處理指令、`std::`、`->`、註解符號…）。' +
  '註解中的記號不計——那是說明，不是產出。同形於核心自身概念的記號（`int`／`<<`／`::`）' +
  '歸「無法確定」，單獨報、不計入安全。'

const SELF_FALSIFICATION =
  '⚠️ 這條護欄的基線是 **0**，而「健康的 0」與「什麼都沒量到的 0」產出完全一樣。' +
  '判斷它有沒有壞的唯一方式是 `tests/unit/helpers/syntax-tokens.test.ts` 那十二支——' +
  '合成注入雙向，**加上拿 git 裡 059 之前的真實程式碼當已知答案的樣本**。' +
  '那組若沒跑或跑綠了卻抓不到樣本裡的耦合，這裡的 0 一律不可信。'

const NOT_DETECTED =
  '本護欄**不檢測**：元件身分（中立性護欄涵蓋，已歸零）、核心 import 語言套件' +
  '（中立性護欄另有一支）、執行期才拼出來的語法（例如從設定組合的字串）、' +
  '語言中立的標點（`,` `(` `)` `=`——那些在任何語言都一樣，判不出來）。' +
  '**歸零不代表 P9 成立**，只代表這三個維度乾淨了。'

interface SyntaxBaseline {
  _meta: BaselineMeta
  definite: number
  ambiguous: number
  files: Record<string, string[]>
}

interface Violation {
  file: string
  token: string
  why: string
  lines: number[]
}

function measure(): { definite: Violation[]; ambiguous: Violation[] } {
  const definite: Violation[] = []
  const ambiguous: Violation[] = []
  for (const dir of SCAN_DIRS) {
    for (const rel of listSourceFiles(dir)) {
      // **只看程式碼，不看註解**——一份解釋這條護欄的說明文件不該變成違規
      // 先遮掉型別位置——**型別位置的字串在編譯後不存在**，不可能被產生出去。
      // 這與 059 的中立性遮罩同一條紀律，理由在那裡也一樣成立。
      const { code } = splitCodeAndComments(
        maskNonIdentityPositions(readFileSync(join(REPO_ROOT, rel), 'utf8')),
      )
      const r = scanSyntaxTokens(code)
      for (const h of r.definite) definite.push({ file: rel, ...h })
      for (const h of r.ambiguous) ambiguous.push({ file: rel, ...h })
    }
  }
  return { definite, ambiguous }
}

const { definite, ambiguous } = measure()
const key = (v: Violation): string => `${v.file}::${v.token}`

describe('護欄：語法耦合（核心不得寫死特定語言的語法記號）', () => {
  it('產出可讀報表', () => {
    const lines: string[] = [SELF_FALSIFICATION, NOT_DETECTED, '', `判定規則：${RULE}`, '']
    lines.push(`確定：${definite.length} 處｜無法確定：${ambiguous.length} 處`)
    lines.push('')
    if (definite.length > 0) {
      lines.push('**確定是語言語法**——核心層產不出別種語言的對應寫法：')
      for (const v of definite) lines.push(`  ${v.file}  →  ${v.token}  @ 行 ${v.lines.join(', ')}｜${v.why}`)
      lines.push('')
    }
    lines.push('（參考｜不計入棘輪）**無法確定**——同形於核心自己的東西，靜態判不出來：')
    const byToken = new Map<string, number>()
    for (const v of ambiguous) byToken.set(v.token, (byToken.get(v.token) ?? 0) + 1)
    for (const [tk, n] of [...byToken].sort((a, b) => b[1] - a[1])) lines.push(`  ${tk}：${n} 個檔`)
    printReport('語法耦合護欄（第九條）', lines)
    expect(definite.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 記號清單不是空的——空的話這條護欄什麼都沒掃', () => {
    expect(
      DEFINITE_TOKENS.length + REGEX_ESCAPED_TOKENS.length,
      '清單空了，掃描會回報 0，而那個 0 與健康的 0 長得一模一樣',
    ).toBeGreaterThan(10)
  })

  it('★ 掃描範圍不是空的——沒掃到檔案的話同上', () => {
    const n = SCAN_DIRS.reduce((s, d) => s + listSourceFiles(d).length, 0)
    expect(n, '一個原始檔都沒掃到 → 報表的每個數字都是假的').toBeGreaterThan(50)
  })

  it('棘輪：不得上升', () => {
    const b = loadBaseline<SyntaxBaseline>('syntax-coupling')
    const known = Object.entries(b.files).flatMap(([file, tokens]) => tokens.map((t) => `${file}::${t}`))
    const 新增 = definite.map(key).filter((k) => !known.includes(k))
    expect(
      新增,
      '核心層新增了語言專屬的語法記號。**中立性護欄看不見這種耦合**——' +
        `它找的是元件身分，而這些一個身分都沒有：\n  ${新增.join('\n  ')}`,
    ).toEqual([])
    assertRatchet([['確定的語法耦合', definite.length, b.definite]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-syntax-coupling.test.ts` */
if (process.env.GENERATE_BASELINE) {
  const files: Record<string, string[]> = {}
  for (const v of definite) (files[v.file] ??= []).push(v.token)
  for (const k of Object.keys(files)) files[k].sort()
  writeBaseline('syntax-coupling', {
    _meta: {
      guard: 'syntax-coupling',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    definite: definite.length,
    ambiguous: ambiguous.length,
    files,
  })
}
