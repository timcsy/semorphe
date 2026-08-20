/**
 * spec 158：**`概念` 從詞彙裡退場，而它不准回來。**
 *
 * ## 為什麼有這條
 *
 * `concepts/元件.md` 的「名詞表（跨域唯一）」**早就定案** `componentId` 取代 `conceptId`
 * ——而程式碼只跟上了一半：**函式名改了，資料欄位沒改**。
 *
 * ```
 * 活在名詞表     ✅ 定案且有「現況落差」表
 * 活在 history/  ❌ 沒有轉變（所以查「決定過沒有」時查不到）
 * 活在護欄裡     ❌ 沒有任何東西擋舊名   ← 這一條就是補它
 * 活在程式碼裡   🟡 一半
 * ```
 *
 * 🔴 而後果是具體的：2026-08-20 建第一顆 Python 膠囊時**照抄了 `conceptId`**
 * ——讀得到程式碼，讀不到那張表。
 *
 * > **一個決定如果沒有機械檢查在守，它會被「照抄現況」慢慢反轉。**
 *
 * ## 判準（人拍板的那條）
 *
 * > 硬體要加進來，而**「概念」對硬體讀不通**
 * > ——「電阻是一顆元件」讀得通，「電阻是一個概念」讀不通。
 *
 * ## ⚠️ 這條**不**掃什麼
 *
 * - `specs/`——那是**病歷**，改它等於竄改當時的記錄
 * - `knowledge/` 裡日常語義的「概念」（1005 次／125 檔，多數不是術語）
 * - 這個檔自己（它必須寫得出舊名才能擋它）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

const ROOTS = ['src', 'tests', 'e2e'] as const
const SELF = 'tests/integration/component-vocabulary.test.ts'
/** 舊詞彙——🔴 每一個都要說得出它被誰取代。 */
const RETIRED: { pattern: RegExp; replacedBy: string }[] = [
  { pattern: /\bconceptId\b/, replacedBy: 'componentId' },
  { pattern: /\bConceptRegistry\b/, replacedBy: 'ComponentRegistry' },
  { pattern: /\bConceptDefJSON\b/, replacedBy: 'ComponentDefJSON' },
  { pattern: /\bConceptExecutor\b/, replacedBy: 'ComponentExecutor' },
]

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(REPO_ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) { walk(rel, out); continue }
    if (/\.(ts|tsx|json)$/.test(e.name)) out.push(rel)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r)).filter((f) => f !== SELF)

describe('spec 158 · 舊詞彙不准回來', () => {
  it('★ 錨點：真的掃到檔案了（否則下面在驗空集合）', () => {
    expect(files.length, '一個檔都沒掃到 → 是掃描壞了，不是沒有檔').toBeGreaterThan(500)
  })

  for (const { pattern, replacedBy } of RETIRED) {
    it(`🔴 \`${pattern.source.replace(/\\b/g, '')}\` 已退場——請用 \`${replacedBy}\``, () => {
      const hits = files
        .filter((f) => pattern.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')))
      expect(hits,
        `舊詞彙回來了。名詞表（\`concepts/元件.md\`）定案 → \`${replacedBy}\`。`
        + '⚠️ 而它回來的方式多半是**照抄現況**——那正是這條護欄存在的理由。').toEqual([])
    })
  }

  it('★ 反向：新詞彙真的在用（否則上面可能只是整個空了）', () => {
    const usingNew = files.filter((f) => /\bcomponentId\b/.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')))
    expect(usingNew.length, '沒有任何檔在用 componentId → 是改名沒落地，不是舊名清乾淨了')
      .toBeGreaterThan(100)
  })
})
