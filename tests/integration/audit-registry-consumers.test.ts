/**
 * 第四十七條護欄：**登錄表必須有產品消費者**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果掃到的登錄表檔數低於下限，代表掃描沒吃到原始碼，這份報表不算數
 * > ——不是「每個登錄表都有人用」。**
 *
 * 錨點是**掃到幾個登錄表**（合成量）。
 * 🔴 **刻意不錨在「零消費者的登錄表數」**——那正是這條護欄要推向零的東西，
 * 錨在它上面的話，**這條護欄成功的那天就是它變紅的那天**
 * （`build-guardrail` 第 2 步簽名一）。
 *
 * ## 為什麼需要這一條
 *
 * `knowledge/concepts/執行機構.md:539` 逐字：
 *
 * > 「建一個唯一真相的機制時，同時交付**遷移**與**一條量採用率的護欄**。
 * > 既有的護欄問的都是『東西對不對』，**沒有一條問過『機制有沒有人用』**。」
 *
 * ⚠️ **那句話寫下之後又被撞了三次，而護欄始終沒蓋。**
 * 同一份文件列了「機制有了，沒人接上」的**十個實例**，
 * 而 2026-08-17 查出**第十一個是 `TargetRegistry` 自己**——
 * spec 134 交付它、測試全綠、檔頭寫得清楚，**而產品程式碼零呼叫**。
 *
 * > **建一個機制不等於它在運作。**（`執行機構.md:527`）
 *
 * ## 為什麼是硬性零而不是棘輪
 *
 * `build-guardrail` 6.8 的第一個問題：「**留一筆在那裡，這條規範還成立嗎？**」
 * ——留一個沒人用的登錄表，「這個機制在運作」這句話就是假的，
 * 而護欄會替它背書。
 *
 * 第二個問題（「**修一筆要付多少？**」）：接上一個登錄表是**幾行**的事，
 * 不需要驗行為。→ 硬性零。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測登錄表裡的東西對不對**——它只問「有沒有人用它」。
 * - **不檢測「只有一個消費者」**。⚠️ 而 `experience.md:1030` 逐字說
 *   「**只有一個的更難發現，因為它看起來是在用的**」——
 *   所以報表**印出全部的數字**，讓 1 看得見。**看得見不等於被擋下。**
 * - **不檢測非登錄表的死匯出**——那是 `knowledge/draft/2026-08-11-死匯出的四種死法.md`
 *   還沒收斂的題目。
 * - **不檢測「被 import 之後有沒有真的被呼叫」**——⚠️ 那是第九個實例的形狀
 *   （`執行機構.md`：「機制被呼叫過，而且結果是對的——只是它只跑了一次」），
 *   而 import 計數看不到它。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, printReport, REPO_ROOT } from '../helpers/guardrail'

/** ⚠️ 串接寫——寫成完整字面的話，這個檔自己會被掃成一個登錄表。 */
const REGISTRY_MARK = 'regi' + 'stry'

/** 只看 `import ... from '...'`，與 `audit-single-entrance` 同一條規則 */
const IMPORT_RE = /(?:from|require\()\s*['"]([^'"]+)['"]/g

interface Row {
  /** repo 相對路徑 */
  file: string
  /** `src/` 內 import 它的檔數（不含自己） */
  consumers: number
}

/** `src/` 底下檔名含 `registry` 的 `.ts`——⚠️ 不含 `index.ts` 那種再匯出。 */
function registryFiles(): string[] {
  return listSourceFiles('src').filter((f) => {
    const base = path.basename(f, '.ts')
    return base.includes(REGISTRY_MARK) || base === REGISTRY_MARK
  })
}

/**
 * 數 `src/` 裡有幾個檔 import 這個模組。
 *
 * 比對 import 字串的**結尾**（相對路徑會長成 `../core/target-registry`），
 * 與 `audit-single-entrance` 的 `forbidden` 同一種比法。
 */
function countConsumers(target: string, sources: string[]): number {
  const stem = target.replace(/\.ts$/, '')
  const tail = stem.endsWith('/index') ? stem.slice(0, -'/index'.length) : stem
  const needle = '/' + path.basename(tail)
  const dir = path.dirname(tail)
  let n = 0
  for (const f of sources) {
    if (f === target) continue
    const src = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]
      if (!spec.startsWith('.')) continue
      const resolved = path.normalize(path.join(path.dirname(f), spec))
      if (resolved === tail || resolved === tail + '/index' || (spec.endsWith(needle) && resolved.startsWith(dir))) {
        n++
        break
      }
    }
  }
  return n
}

function measure(): Row[] {
  const sources = listSourceFiles('src')
  return registryFiles()
    .map((file) => ({ file, consumers: countConsumers(file, sources) }))
    .sort((a, b) => b.consumers - a.consumers)
}

const RULE = '`src/` 底下每個登錄表模組，數「`src/` 內有幾個檔 import 它」。零 = 違規。'

describe('第四十七條護欄：登錄表必須有產品消費者', () => {
  const rows = measure()
  const orphans = rows.filter((r) => r.consumers === 0)

  it('★ 入口條件：掃到的登錄表檔數（合成量，不隨修復變小）', () => {
    printReport('登錄表的產品消費者數', [
      `規則：${RULE}`,
      '',
      ...rows.map((r) => {
        const mark = r.consumers === 0 ? '🔴' : r.consumers === 1 ? '⚠️ ' : '🟢'
        return `  ${mark} ${String(r.consumers).padStart(4)}  ${r.file}`
      }),
      '',
      '⚠️ 消費者數為 1 的**不算違規**，而它是「機制有了沒人接上」最難發現的變體',
      '   （experience.md:1030：「只有一個的更難發現，因為它看起來是在用的」）。',
    ])

    // 🔴 錨在**掃到幾個**，不是**幾個違規**——見檔頭的自我否證聲明
    expect(
      rows.length,
      `只掃到 ${rows.length} 個登錄表 → 掃描沒吃到原始碼，這份報表不算數。` +
        `⚠️ 這不代表「每個登錄表都有人用」。`,
    ).toBeGreaterThanOrEqual(8)
  })

  it('★ 硬性零：沒有產品消費者的登錄表', () => {
    expect(
      orphans.map((r) => r.file),
      '🔴 這些登錄表沒有任何產品程式碼 import 它們——' +
        '「建一個機制不等於它在運作」（concepts/執行機構.md:527）。\n' +
        '⚠️ 硬性零而不是棘輪：留一筆在那裡，「這個機制在運作」這句話就是假的。\n' +
        '→ 接上它，或者刪掉它。**不要把它加進例外清單。**',
    ).toEqual([])
  })

  it('★ 注入①：合成一個零消費者的登錄表 → 必須被指名', () => {
    const fake = 'src/core/__synthetic__-' + REGISTRY_MARK + '.ts'
    const found = [{ file: fake, consumers: countConsumers(fake, ['src/core/types.ts']) }]
      .filter((r) => r.consumers === 0)
    expect(found.map((r) => r.file), '🔴 合成的零消費者登錄表沒有被判為違規').toEqual([fake])
  })

  it('★ 注入②：有消費者的合成輸入 → 不得亂報', () => {
    // 拿一個**確定有很多消費者**的真實模組當輸入，證明計數器不是恆為零。
    const real = 'src/core/types.ts'
    expect(
      countConsumers(real, listSourceFiles('src')),
      '🔴 一個明顯被大量 import 的模組被數成 0 → 計數器壞了，' +
        '而那會讓「硬性零」這一支變成一片假紅。',
    ).toBeGreaterThan(20)
  })
})
