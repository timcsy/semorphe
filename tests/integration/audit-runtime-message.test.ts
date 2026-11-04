/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
/**
 * **第四十四條護欄**：執行期停下來時，推給使用者看的字串**不得長得像代號**。
 *
 * ## 它從哪來
 *
 * 2026-08-15 的探針量了第一課的學生會犯的 9 種錯。放行的那兩種，
 * 學生在輸出區看到的是：
 *
 * ```
 * RUNTIME_ERR_UNDECLARED_VAR: {"%1":"Cout"}
 * ```
 *
 * 🔴 **這是一天前才修過的病**（`monaco-panel` 查 `window.Blockly?.Msg` 永遠
 * 走 fallback，把 `DIAG_MISSING_CONDITION` 顯示給使用者，spec `121`）。
 *
 * ## 🔴 而第四十二條護欄沒接住它，理由不是「漏了一族」
 *
 * ```
 * audit-diagnostic-labels 量的   文案【在不在】       ✅ 是綠的
 * 而缺陷是                       顯示端【有沒有查】    🔴 從來不查
 * ```
 *
 * > **文案齊全，而沒有人查它。**
 *
 * 所以這一條**錨在顯示邊界**，不錨在文案表。
 *
 * > **一條護欄如果只涵蓋「上次出事的那一族」，它防的是上一次，不是這一類。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的拋出點數」斷言變紅，代表掃描沒吃到原始碼，
 * > 這份報表不算數——不是「缺陷被修好了」。**
 *
 * 錨在**拋出點數**（合成量）上：
 * **修好一則訊息不會少一個拋出點**，所以它不隨修復下降
 * （`build-guardrail` 的第三個簽名）。
 *
 * 🔴 **刻意不錨在「顯示代號的數量」**——那正是這條護欄要推向零的東西，
 * 錨在它上面等於「成功的那天變紅」。
 *
 * ## 為什麼量測單位是 (身分, 參數) 組合，不是原始碼行
 *
 * 原本設想的做法是掃 `src/ui/` 找「把字串推給使用者的地方」。
 * ⚠️ **那會誤報，而誤報是這條護欄唯一的死法**：`src/` 裡到處都是開發期
 * 日誌，判準寬一格就會報一整片，然後被人加進忽略清單
 * （`build-guardrail` 第 11 步）。
 *
 * > **誤報的風險不是靠判準寫嚴來消除的，是靠【量測單位選對】來消除的。**
 *
 * 開發期日誌**永遠進不了**「走過顯示路徑的結果」這個集合。
 *
 * ## 硬性零，而且**沒有基線檔**
 *
 * `build-guardrail` 6.8 的三個問題：
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「系統說的話是人話」留一個反例就是假的
 * 修一筆要付多少？       便宜——補一則文案／改一個模板，不改行為
 * 別台機器一樣嗎？       ✅ 純字串比對，沒有外部工具
 * ```
 *
 * → 硬性零。而**硬性零不需要基線檔**：`toBe(0)` 本身就是棘輪，
 * 再擺一個永遠寫著 `0` 的 JSON 是形式而不是機構。
 * ⚠️ 所以本護欄**不會動 `tests/baselines/` 的任何數字**。
 *
 * ## 本護欄不檢測什麼
 *
 * - 🔴 **不檢測「有沒有第四個顯示點繞過顯示函式」**。它量的是
 *   *經過* `describeRuntimeStop` 的結果；有人直接推 `err.message`
 *   它看不到。**第二支測試（顯示端唯一性）補這一刀，而那一支是靜態的。**
 * - **不檢測訊息寫得好不好**。「除以零」是不是好句子不在射程內
 *   ——那沒有機械判準（`specs/119` 的文獻回顧：六十年沒有共識）。
 * - **不檢測參數的值對不對**。`{'%1': 'array'}` 該不該是 `'陣列'`
 *   是文案品質，不是本護欄的量。
 * - **不檢測積木側**。積木側的診斷由第四十二條守著。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { setMessages, resetMessages } from '../../src/i18n/messages'
import { describeRuntimeStop } from '../../src/ui/runtime-message'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'

const SRC = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

/** 一個拋出點：停止原因身分 ＋ 它實際傳了哪些參數名。 */
interface ThrowSite {
  file: string
  key: string
  paramNames: string[]
}

/**
 * 從「身分之後」的那段文字裡，取出**第二個引數那個物件字面**的第一層鍵。
 *
 * 沒有物件字面（下一個非空白是 `)` 或 `,` 後面跟著非 `{`）→ 回空陣列。
 */
function topLevelKeys(after: string): string[] {
  const comma = after.indexOf(',')
  if (comma === -1) return []
  const rest = after.slice(comma + 1)
  const open = rest.search(/\S/)
  if (open === -1 || rest[open] !== '{') return []
  let depth = 0
  let end = -1
  for (let i = open; i < rest.length; i++) {
    if (rest[i] === '{') depth++
    else if (rest[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) return []
  const body = rest.slice(open + 1, end)

  // 🔴 **簡寫屬性也要算**（2026-08-26 補）。這裡本來只認 `name: value`
  // ——找第一層的 `:`，取它前面那個識別字。於是 「component 逗號」這種簡寫 這種
  // **簡寫**被讀成「沒有參數」。
  //
  // ⚠️ 而它的代價正是這個檔第 166 行自己寫下的顧慮：
  //
  // > 「那不會造成假違規……**而它會讓報表說謊**，
  // >  而一份說謊的報表推導不出『使用者到底看到什麼』」
  //
  // 症狀是**假違規**：訊息模板裡的 那個具名佔位符 明明會被填上，
  // 而護欄餵了一組空參數進去，於是報「未替換的具名佔位符」。
  // **一個看不見簡寫的掃描器，會把一個正確的訊息判成缺陷。**
  //
  // → 做法：先用第一層逗號切段，每一段各自問「它是 `k: v` 還是一個裸識別字」。
  const keys: string[] = []
  for (const seg of splitTopLevel(body)) {
    const colon = topLevelColon(seg)
    if (colon >= 0) {
      const km = /(?:'([^']*)'|"([^"]*)"|(\w+))\s*$/.exec(seg.slice(0, colon))
      if (km) keys.push(km[1] ?? km[2] ?? km[3])
      continue
    }
    // 簡寫（`component`）——⚠️ 展開（`...x`）沒有名字，不算
    const short = /^\s*(\w+)\s*$/.exec(seg)
    if (short) keys.push(short[1])
  }
  return keys
}

/** 依**第一層**逗號切段（括號／大括號／方括號裡的逗號不算）。 */
function splitTopLevel(body: string): string[] {
  const segs: string[] = []
  let d = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '{' || c === '[' || c === '(') d++
    else if (c === '}' || c === ']' || c === ')') d--
    else if (c === ',' && d === 0) { segs.push(body.slice(start, i)); start = i + 1 }
  }
  segs.push(body.slice(start))
  return segs
}

/** 這一段裡第一層的 `:` 在哪；沒有就回 -1。 */
function topLevelColon(seg: string): number {
  let d = 0
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]
    if (c === '{' || c === '[' || c === '(') d++
    else if (c === '}' || c === ']' || c === ')') d--
    else if (c === ':' && d === 0) return i
  }
  return -1
}

/**
 * 從原始碼掃出「會推給使用者看的執行期錯誤」的 (身分, 參數名) 組合。
 *
 * 🔴 **spec 208（重構 6c-4）改寫**：原本掃 JS 直譯器的 `new RuntimeError(RUNTIME_ERRORS.X, {…})`。直譯器刪掉之後，
 * 執行期的錯誤全部來自 **Cella 那條鏈**——執行控制器與提供者的 `new SessionStop('runtime', 'RUNTIME_ERR_…', {…})`，
 * 以及 worker 把 Cella 的 kind 對到鍵的那張表（`UB_KEY` 等）。不改寫的話這條護欄會**掃到零個而空轉**（6c 盤點風險 5）。
 *
 * 參數名的來源：
 * ① 寫在 `new SessionStop(…, '鍵', { a: …, b: … })` 裡的，照原始碼取；
 * ② 其餘（鍵出現在對照表、參數由 Cella 的判決動態帶來）照**中文文案模板要的佔位符**餵——
 *    ⚠️ 這一半靜態量不到「Cella 實際有沒有送那個參數」：沒送的話畫面會出現未替換的 `{clause}`。
 *    那一層等 Cella 的結構化 params 與 `verdict-kinds.json` 出來，由「每個結構化的 kind 都有文案」那條護欄接手。
 */
function scanThrowSites(): ThrowSite[] {
  const out: ThrowSite[] = []
  const tmpl = zhTW as Record<string, string>
  const placeholders = (key: string): string[] => {
    const t = tmpl[key] ?? ''
    return [...new Set([...t.matchAll(/\{(\w+)\}|(%\d)/g)].map((m) => m[1] ?? m[2]))]
  }
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8')
    const rel = file.replace(process.cwd() + '/', '')
    const explicit = new Set<string>()
    for (const m of text.matchAll(/new SessionStop\(\s*'(?:runtime|aborted)'\s*,\s*'(RUNTIME_ERR_[A-Z_]+)'\s*(?:,\s*\{([^}]*)\})?/g)) {
      explicit.add(m[1])
      const names = m[2] === undefined ? [] : [...m[2].matchAll(/(\w+)\s*:/g)].map((x) => x[1])
      out.push({ file: rel, key: m[1], paramNames: names.length > 0 ? names : placeholders(m[1]) })
    }
    for (const m of text.matchAll(/'(RUNTIME_ERR_[A-Z_]+)'/g)) {
      if (explicit.has(m[1])) continue
      out.push({ file: rel, key: m[1], paramNames: placeholders(m[1]) })
    }
  }
  return out
}

/** 代號的形狀——這四種出現在畫面上都是缺陷。 */
const CODE_SHAPES: Array<[RegExp, string]> = [
  [/RUNTIME_ERR_[A-Z_]+/, '原始代號'],
  [/%\d/, '未替換的位置佔位符'],
  [/\{\w+\}/, '未替換的具名佔位符'],
  [/[{}]/, 'JSON 大括號'],
]

const LOCALES: Array<[string, Record<string, string>]> = [
  ['zh-TW', zhTW as Record<string, string>],
  ['en', en as Record<string, string>],
]

describe('第四十四條護欄：執行期停下來時說的是人話', () => {
  it('★ 入口條件——掃到的拋出點數（合成量，不隨修復下降）', () => {
    const sites = scanThrowSites()
    expect(
      sites.length,
      `只掃到 ${sites.length} 個拋出點 → 掃描沒吃到原始碼，這份報表不算數。` +
        `⚠️ 這不代表「缺陷被修好了」——見檔頭的自我否證聲明。`,
    ).toBeGreaterThanOrEqual(16)
    // spec 208：直譯器刪掉之後，Cella 那條鏈的鍵（2026-11-04 量到 16 種）——少於這個數就是掃描沒吃到
    expect(new Set(sites.map(s => s.key)).size).toBeGreaterThanOrEqual(12)
  })

  it('★ 每一個 (身分, 參數) 組合走過顯示路徑，結果都不得長得像代號', () => {
    const sites = scanThrowSites()

    const violations: string[] = []
    for (const [locale, table] of LOCALES) {
      resetMessages()
      setMessages(table)
      const seen = new Set<string>()
      for (const site of sites) {
        const sig = `${locale}|${site.key}|${site.paramNames.join(',')}`
        if (seen.has(sig)) continue
        seen.add(sig)
        // 參數餵合成值——本護欄不管值對不對，只管「有沒有被填上」
        const params = Object.fromEntries(site.paramNames.map(n => [n, 'ⓧ']))
        const shown = describeRuntimeStop(site.key, params)
        for (const [re, what] of CODE_SHAPES) {
          if (re.test(shown)) {
            violations.push(`  ${locale}  ${site.key}  參數[${site.paramNames.join(',') || '無'}]  → ${what}：「${shown}」  (${site.file})`)
            break
          }
        }
      }
    }
    resetMessages()

    if (violations.length > 0) {
      console.log(`\n🔴 ${violations.length} 個組合會把代號推到使用者眼前：\n${violations.join('\n')}\n`)
    }
    expect(
      violations.length,
      `硬性零：留一筆「顯示代號」，「系統說的話是人話」這句就是假的。\n${violations.join('\n')}`,
    ).toBe(0)
  })

  it('★ 注入①：一個沒有文案的合成身分 → 必須會報，且指名', () => {
    resetMessages()
    setMessages({ ...(zhTW as Record<string, string>) })
    const shown = describeRuntimeStop('RUNTIME_ERR_ZZ_SYNTH_NO_TEXT', {})
    resetMessages()
    // 退回通用的一句話，而**不是**代號
    expect(shown).not.toMatch(/RUNTIME_ERR_/)
    expect(shown.length).toBeGreaterThan(2)
  })

  it('★ 注入②：文案與參數對得上的合成身分 → 必須不亂報', () => {
    resetMessages()
    setMessages({ ...(zhTW as Record<string, string>), RUNTIME_ERR_ZZ_SYNTH_OK: '合成的一句話：%1' })
    const shown = describeRuntimeStop('RUNTIME_ERR_ZZ_SYNTH_OK', { '%1': 'ⓧ' })
    resetMessages()
    expect(shown).toBe('合成的一句話：ⓧ')
    for (const [re] of CODE_SHAPES) expect(re.test(shown)).toBe(false)
  })

  it('★ 注入③：文案要兩個參數而只傳一個 → 必須會報', () => {
    resetMessages()
    setMessages({ ...(zhTW as Record<string, string>), RUNTIME_ERR_ZZ_SYNTH_GAP: '要兩個：%1 與 %2' })
    const shown = describeRuntimeStop('RUNTIME_ERR_ZZ_SYNTH_GAP', { '%1': 'ⓧ' })
    resetMessages()
    // 沒被替換的 %2 留在句子裡——那與代號一樣糟，而更難發現
    expect(CODE_SHAPES.some(([re]) => re.test(shown))).toBe(true)
  })

  it('★ 注入④：**簡寫屬性**必須被讀出來——不然報表會說「沒有參數」', () => {
    // 🔴 2026-08-26：這條缺口讓一個**正確的**訊息被判成缺陷。
    // 掃描器只認 `name: value`，於是 「component 逗號」這種簡寫 被讀成「沒有參數」，
    // 護欄餵一組空參數進去，那個具名佔位符 沒被替換 → 報「未替換的具名佔位符」。
    //
    // ⚠️ 實測那天 `src/` 裡**只有一處**用簡寫——也就是說這個缺口
    // 一直在，而**從來沒有受害者**。它不是「壞了很久沒發現」，
    // 是「第一個踩到的人今天才出現」。
    expect(topLevelKeys("UNKNOWN, {\n  component,\n})"), '簡寫').toEqual(['component'])
    expect(topLevelKeys('UNKNOWN, { component, hint: 1 })'), '簡寫＋一般混用').toEqual(['component', 'hint'])
    expect(topLevelKeys('UNKNOWN, { a: 1, ...(x ? {} : { b: 2 }) })'), '展開沒有名字，不得算進來').toEqual(['a'])
    expect(topLevelKeys('UNKNOWN, { f: g(1, 2), h: [3, 4] })'), '巢狀裡的逗號不切段').toEqual(['f', 'h'])
    // ★ 反向：真的沒有參數時仍然回空——否則上面那條會被一個「什麼都當簡寫」的實作矇混
    expect(topLevelKeys('UNKNOWN)'), '根本沒有第二個引數').toEqual([])
  })

  it('★ 顯示端唯一性——不得有第二個地方直接推錯誤的原始訊息', () => {
    const offenders: string[] = []
    for (const file of walk(join(SRC, 'ui'))) {
      if (file.endsWith('runtime-message.ts')) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?:broadcastOutput|showToast|setWarningText)\s*\(\s*(\w+)\.message\b/g)) {
        offenders.push(`  ${file.replace(process.cwd() + '/', '')} → 直接推 ${m[1]}.message`)
      }
    }
    expect(
      offenders.length,
      `🔴 有顯示端繞過了顯示函式，它推的是給開發者看的字串：\n${offenders.join('\n')}\n` +
        `⚠️ 而上面那條「每個組合」的檢查【看不到】這種繞過——它只量經過顯示函式的結果。`,
    ).toBe(0)
  })
})
