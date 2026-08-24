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

/**
 * 🔴 **spec 159：從「擋四個名字」擴成「擋整個 concept 家族」。**
 *
 * spec 158 的護欄只認 `\bconceptId\b`——於是 `byConceptId`（大寫 C 讓 `\b` 不成立）、
 * `getVisibleConcepts`、`registerCallConcept`、檔名 `method-components.ts` 全部漏掉。
 * 2026-08-20 實測**還有 3496 處**散在 656 個檔，而護欄一個都沒擋住。
 *
 * > **一條擋「四個名字」的規則，擋不住一個【家族】。**
 *
 * ## 具名豁免（每一條都要說得出理由——靠路徑規則順便放過就是用宣告刷數字）
 */
const EXEMPT: { path: RegExp; why: string }[] = [
  { path: /^tests\/integration\/component-vocabulary\.test\.ts$/,
    why: '護欄自己——它要寫得出舊名才擋得住舊名' },
  { path: /^tests\/baselines\//,
    why: '量測工具不得量到自己（基線 JSON 會數到護欄的規則文字）' },
  { path: /^src\/migrations\//,
    why: '凍結明表——它的鍵是【過去】的身分，改掉等於真實使用者的舊存檔升不上來' },
  { path: /^src\/languages\/[^/]+\/id-migrations\.ts$/,
    why: '同上：語言側的凍結明表' },
  // ⚠️ 2026-08-22 加：這個檔裝的是**第三方文法的節點型別名**（tree-sitter-cpp 的
  //    `node-types.json`），而 `concept_definition` 是 **C++20 的語言關鍵字**
  //    ——它與本專案退場的那個詞彙同形，卻不是同一個字。
  //    🔴 改掉它等於改掉全集的鍵，那條護欄就對不上任何一格。
  { path: /^tests\/assets\/corpus-shape-decisions-cpp\.json$/,
    why: '第三方文法的節點型別名——`concept_definition` 是 C++20 的關鍵字，不是本專案的舊詞彙' },
]

/**
 * 掃描前先遮掉**兩種指向別處的路徑**——它們是引用，不是本專案的詞彙：
 *
 * - `knowledge/concepts/`：知識庫資料夾，人拍板**不改名**（它裝的是知識層的概念，
 *   不是產品層的元件——見 `concepts/元件.md`「為何是『元件』不是『概念』」）
 * - `specs/NNN-…concept…/`：**病歷**。目錄名記錄的是那一刀當時叫什麼，
 *   改它等於竄改記錄（component-rename 第六步的第一類誤傷）
 *
 * ⚠️ 遮掉的是**路徑字面**，不是整個檔——同一個檔裡別的地方寫了 `concept` 照樣會被抓。
 */
const REFERENCE_PATHS =
  /(?:knowledge\/|\.\.\/)?concepts\/|specs\/concepts\/?|specs\/\d+-[a-z0-9-]*concept[a-z0-9-]*/g
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
/**
 * 🪦 **墓碑豁免**——與「宣告退場的那一行」同一個道理：
 * 一行**說這東西已經沒了**的字，必須寫得出它的名字。
 *
 * ```
 * | ❌ ~~`UniversalConcept` 型別~~ | **該型別已刪**（58d64eb，只剩墓碑註解） |
 * ```
 *
 * ⚠️ 判準是**這一行有沒有說它不在了**，不是它長什麼樣（刪節線只是其中一種寫法）。
 */
const TOMBSTONE = /~~|已刪|已不存在|已刪除|已退休|不再調用|已被.{0,6}取代/

const KNOWLEDGE_ROOTS = [
  'knowledge/concepts', 'knowledge/principles.md', 'knowledge/vision.md',
  // 🔴 **`skills/` 會【執行】**——它指名的函式不存在時，照著做的人會撞牆。
  // 判官的話：stale skill 的風險高於 stale doc（它動手，不只誤導）。
  //
  // ⚠️ 2026-08-20 實測：spec 159 把程式碼改完了，而 5 支 skill 還寫著
  // `findConcepts(`（程式碼 0 處，實際叫 `findComponents`）、`UniversalConcept`（0 處）。
  // 漏掉的原因與改名當天漏掉 `package.json` **是同一個形狀**：
  // > **掃描根寫死了，而下游不只那三個資料夾。**
  'knowledge/skills',
]

/**
 * 🟢 **「宣告退場」的那一行豁免**——與這個測試檔自己豁免是**同一個理由**：
 * 宣告「X 退場、改用 Y」的地方**必須寫得出 X**，否則它無從宣告。
 *
 * 判準是**逐行**的，而且不看語法長相：**這一行有沒有同時寫出舊名與取代它的新名**。
 * 有 → 它是一筆對照，留著；只有舊名 → 它是活的用法，該改。
 *
 * ⚠️ 第一版寫成「`concepts/元件.md` 的表格列豁免」——**太窄了**。
 * 2026-08-20 根公理的理由塊（一段引言，不是表格）同樣在宣告退場，被誤報。
 * > **豁免要照【它為什麼合法】寫，不要照【它長什麼樣】寫。**
 */
function scannableLines(text: string, retired: RegExp, replacedBy: string): string {
  return text.split('\n')
    .filter((l) => !(retired.test(l) && l.includes(replacedBy)))
    .join('\n')
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

describe('spec 159 · 整個 concept 家族退場', () => {
  // ⚠️ **`[Cc]` 不夠——全大寫的 `CONCEPT_IDENTITY` 兩個都不匹配。**
  // spec 159 的家族規則漏了 77 處全大寫形式，2026-08-20 判官掃出來。
  // > 這是 spec 158「`\bconceptId\b` 擋不住 `byConceptId`」的同一種病：
  // > **規則寫得比它要擋的東西窄，而它會綠。**
  const family = /CONCEPT|[Cc]oncepts?/
  const scanned = files.filter((f) => !EXEMPT.some((e) => e.path.test(f)))

  it('★ 錨點：豁免沒有把檔案掃光', () => {
    expect(scanned.length).toBeGreaterThan(500)
    // `tests/baselines/` 是**整個目錄**的豁免（34 份基線），它不是「順便放過」而是
    // 「量測工具不得量到自己」。⚠️ 真正該盯的是**它以外**還豁免了幾個檔。
    const exemptOutsideBaselines = files.filter(
      (f) => !f.startsWith('tests/baselines/') && EXEMPT.some((e) => e.path.test(f)))
    expect(exemptOutsideBaselines.sort(),
      '基線目錄以外的豁免必須逐一具名——多一個就是靠路徑規則順便放過').toEqual([
      'src/languages/cpp/id-migrations.ts',
      'src/migrations/block-type-migrations.ts',
      'src/migrations/id-migrations.ts',
      'src/migrations/merged-identities.ts',
      'tests/assets/corpus-shape-decisions-cpp.json',
    ])
  })

  it('🔴 `concept` 家族已整族退場——請用 `component` 家族', () => {
    const hits = scanned
      .map((f) => ({ f, n: (fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')
        .replace(REFERENCE_PATHS, '').match(new RegExp(family, 'g')) ?? []).length }))
      .filter((x) => x.n > 0)
    const total = hits.reduce((a, b) => a + b.n, 0)
    expect(total,
      `還有 ${total} 處散在 ${hits.length} 個檔。`
      + '⚠️ 這條是【硬性零】不是棘輪——改名的修法很便宜（見 build-guardrail 6.8）。'
      + `最大的：${hits.sort((a, b) => b.n - a.n).slice(0, 5).map((x) => `${x.f}(${x.n})`).join(' ')}`)
      .toBe(0)
  })

  it('🔴 檔名也不准帶 concept', () => {
    expect(scanned.filter((f) => /concept/i.test(path.basename(f))), '檔名是識別字').toEqual([])
  })

  it('★ 存檔格式不受本輪影響——SavedState 沒有任何 concept 欄位', () => {
    const sv = fs.readFileSync(path.join(REPO_ROOT, 'src/core/storage-version.ts'), 'utf8')
    // ⚠️ **邊界要收在那個常數自己身上**——原本切到 `REQUIRED_FIELDS`，
    //    於是 2026-08-24 在兩者之間加一段**註解**（裡面提到 `concepts/…`）就誤報了。
    //    **一個用「下一個常數的名字」當結尾的切片，切的是位置不是那個東西。**
    const start = sv.indexOf('SAVED_STATE_FIELDS')
    const fields = sv.slice(start, sv.indexOf('} satisfies', start))
    expect(family.test(fields),
      '⚠️ 若存檔欄位出現 concept，本輪就【需要】一次存檔版本＋凍結明表（見 component-rename 步驟 5）')
      .toBe(false)
  })
})

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

  /**
   * 🔴 **`skills/` 用【家族】規則，不是那五個指名的字。**
   *
   * 2026-08-20 判官實測：spec 159 把程式碼改完了，而 5 支 skill 還寫著
   * `findConcepts(`（程式碼 **0 處**，實際叫 `findComponents`，91 處）、
   * `UniversalConcept`（0 處）、`getVisibleConcepts`（實際 `getVisibleComponents`）。
   * 窄規則一個都沒擋到——**skill 會照著做，它不只是誤導。**
   */
  it('🔴 `skills/` 不得指名 concept 家族——除非那一行在立墓碑', () => {
    /**
     * 兩條**整檔**豁免，各自說得出理由：
     * - `component-rename`：**它的主題就是改名**，全篇必須寫得出舊名
     *   （與這個測試檔自己豁免同一條理由）
     * - `status: superseded` 的 skill：**它整份就是紀錄**。判官明說退休的 skill
     *   不該被「修復」——那等於把它復活
     */
    const skills = walkMd('knowledge/skills').filter((f) => {
      if (f.includes('component-rename/')) return false
      return !/^---[\s\S]*?status:\s*superseded/.test(
        fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'))
    })
    const hits: string[] = []
    for (const f of skills) {
      const text = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')
      text.split('\n').forEach((line, i) => {
        const bare = line.replace(REFERENCE_PATHS, '')
        if (/CONCEPT|[Cc]oncepts?/.test(bare) && !TOMBSTONE.test(line)) hits.push(`${f}:${i + 1}`)
      })
    }
    expect(hits,
      '⚠️ skill 指名的符號要嘛存在，要嘛那一行要說它已經不在了（墓碑）。'
      + '兩者都不是的話，照著做的人會撞牆。').toEqual([])
  })

  it('★ 錨點：知識庫的現況型檔案真的掃到了', () => {
    expect(knowledgeFiles.length, '一個 .md 都沒掃到 → 掃描壞了').toBeGreaterThan(10)
    expect(knowledgeFiles).toContain('knowledge/principles.md')
  })

  for (const { pattern, replacedBy } of RETIRED) {
    it(`🔴 知識庫（現況型）不得留 \`${pattern.source.replace(/\\b/g, '')}\``, () => {
      const hits = knowledgeFiles
        .filter((f) => new RegExp(pattern.source + '|' + pattern.source.replace(/\\b$/, '') + 's\\b')
          .test(scannableLines(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), pattern, replacedBy)))
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
