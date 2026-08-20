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
  { pattern: /\babstractConcept\b/, replacedBy: 'abstractComponent' },
]

/**
 * 🔴 **知識庫也要守——而只守【現況型】的檔。**
 *
 * 判準不是資料夾，是**這份文件描述的是「現在」還是「當時」**：
 * `concepts/` 與 `principles.md`／`vision.md` 說的是現在 → 舊名是**過期**；
 * `history/`／`experience.md`／`specs/` 說的是當時 → 舊名是**病歷**，改它等於竄改記錄。
 *
 * ⚠️ 不擋中文的「概念」——[名詞表](../../knowledge/concepts/元件.md)已經定：
 * **概念是元件在語言域的樣子**，談語言時它仍然讀得通。擋的是**識別字**。
 */
const KNOWLEDGE_ROOTS = ['knowledge/concepts', 'knowledge/principles.md', 'knowledge/vision.md']

/**
 * 🟢 **名詞表的表格列豁免**——與這個測試檔自己豁免是**同一個理由**：
 * 宣告「X 退場、改用 Y」的地方**必須寫得出 X**，否則它無從宣告。
 * `concepts/元件.md` 的「名詞表」與「現況落差」兩張表就是那個地方。
 */
const GLOSSARY = 'knowledge/concepts/元件.md'
function scannableLines(rel: string, text: string): string {
  if (rel !== GLOSSARY) return text
  return text.split('\n').filter((l) => !l.trimStart().startsWith('|')).join('\n')
}

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

function walkMd(target: string, out: string[] = []): string[] {
  const abs = path.join(REPO_ROOT, target)
  if (!fs.existsSync(abs)) return out
  if (fs.statSync(abs).isFile()) { out.push(target); return out }
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(target, e.name)
    if (e.isDirectory()) walkMd(rel, out)
    else if (e.name.endsWith('.md')) out.push(rel)
  }
  return out
}
const knowledgeFiles = KNOWLEDGE_ROOTS.flatMap((r) => walkMd(r))

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

  it('★ 錨點：知識庫的現況型檔案真的掃到了', () => {
    expect(knowledgeFiles.length, '一個 .md 都沒掃到 → 掃描壞了').toBeGreaterThan(10)
    expect(knowledgeFiles).toContain('knowledge/principles.md')
  })

  for (const { pattern, replacedBy } of RETIRED) {
    it(`🔴 知識庫（現況型）不得留 \`${pattern.source.replace(/\\b/g, '')}\``, () => {
      const hits = knowledgeFiles
        .filter((f) => new RegExp(pattern.source + '|' + pattern.source.replace(/\\b$/, '') + 's\\b')
          .test(scannableLines(f, fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'))))
      expect(hits,
        `⚠️ 這是 spec 158 大改名的殘留。\`${replacedBy}\` 才是現在的名字。`
        + '（`history/`／`experience.md` 不在此列——那裡的舊名是**病歷**，必須留。）').toEqual([])
    })
  }

  it('★ 反向：新詞彙真的在用（否則上面可能只是整個空了）', () => {
    const usingNew = files.filter((f) => /\bcomponentId\b/.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')))
    expect(usingNew.length, '沒有任何檔在用 componentId → 是改名沒落地，不是舊名清乾淨了')
      .toBeGreaterThan(100)
  })
})
