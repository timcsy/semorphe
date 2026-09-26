/**
 * **knowie 的機械掃描器**——判官（`/knowie-judge`）§3 那幾條用 grep/ls 做的檢查。
 *
 * ## 🔴 它為什麼要存在
 *
 * 2026-09-26 的第二次判官一輪掃出七筆，而**前五筆是掃描器自己的缺陷**：
 *
 * ```
 * ① 相對路徑沒有對著所在檔解析        → 80 筆假死連結
 * ② 正則的 [^)\]] 吃掉換行            → 一次貪婪比對吞掉整區,漏判一個檔
 * ③ grep 命中的是一份「路徑清單」      → 誤判 write-lesson 已退休
 * ④ 不認得 [[history/NNN]] 這種記法    → 「反向邊斷了四天」這個頭條當場垮掉
 * ⑤ 標記詞表沒有「🟡 狀態：」          → 兩份 draft 被誤報沒有升格標記
 * ```
 *
 * 而 `knowledge/README.md` 早在 2026-08-19（上一次判官）就寫下了那條教訓：
 *
 * > **一個掃描如果不知道自己在掃什麼命名空間，它的每一筆命中都要人再判一次
 * > ——而那正是它想省掉的工。**
 *
 * ⟹ **缺的不是那條教訓，是它的載體。**那五條規則原本散在五支一次性的 python 裡，
 * 判完就沒了，於是下一輪重推一遍、重踩一遍。本檔是它們的住處。
 *
 * ## ⚠️ 為什麼是 TypeScript 而不是 python
 *
 * 第一版寫成 `tools/knowie-scan.py`，而**護欄不能靠一個 CI 上沒有宣告的解譯器**
 * ——GitHub runner 今天有 python3，而那是**運氣不是契約**。這個 repo 已經
 * 三次被「本機那一台比 CI 那一台寬鬆」咬過（`CLAUDE.md` 有那三次）。
 *
 * > **一個護欄如果依賴一個沒有人宣告的東西，它量的是那台機器的運氣。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * **任何一項掃到的母體是 0，代表路徑寫錯了，不是那一項乾淨了。**
 * 每一項都回報母體，而 `emptyPopulations` 非空時呼叫方必須紅。
 */
import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs'
import { join, dirname, normalize, relative, basename } from 'node:path'

export interface ScanResult {
  /** 這一項的名字 */
  name: string
  /** 🔴 母體——「乾淨」與「路徑寫錯了」在讀數上長得一樣，所以它一定要回報 */
  population: number
  /** 發現 */
  hits: string[]
  /** 為什麼這一項這樣問 */
  note: string
  /** 🟡 判不了的：舊的「做完才退場」被下面的更正推翻時，兩句都還在檔裡 */
  adjudicate?: boolean
}

const SUBDIRS = ['concepts', 'episodes', 'history', 'draft'] as const

/** 規則②：**不得吃換行**，也不得吃反引號與 `]`——第一版的貪婪比對吞掉了整個區段。 */
const LINK = /\[[^\]\n]*\]\(([^)\s`\n]+)\)/g
const NAMED = /\[\[([^\]\n]+)\]\]/g
/** 規則③之二：行內程式碼裡的 `[[…]]` 是程式碼不是指名（實測：`assertRatchet([[名稱, 現值]], …)`）。 */
const INLINE_CODE = /`[^`\n]*`/g
/** 規則⑤：狀態／升格標記的詞表。**少一個詞就會誤報一份 draft。** */
const MARKERS =
  /升格|in-flight|進行中|不退休|不退場|重新指向|已促成|已反流|設計理據|設計理由|設計脈絡|狀態[：:]|未承諾|已表態|設計未決/
/** 規則③：「退休」讀 frontmatter 的**欄位**，不是 grep 全文——grep 會命中檔案裡的路徑清單。 */
const RETIRED_FIELD = /^\s*status:\s*(retired|superseded)\s*$/m
/** 規則④：`[[history/283]]` 這種**前綴形**也是合法指名。 */
const PREFIXED = /^(history|episodes|concepts|draft|skills)\//
/** markdown 裡的程式碼片段會長得像指名——`["arr","arr"]`、`[0, 9]`、`['x','x']`。 */
const CODEISH = /["']|^\s*[-\d]|,\s*\d/

const CORE = new Set(['經驗', '原則', '願景', 'experience', 'principles', 'vision'])

function walkMd(base: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = join(base, e.name)
    if (e.isDirectory()) out.push(...walkMd(p))
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

function matches(re: RegExp, text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(new RegExp(re.source, 'g'))) out.push(m[1])
  return out
}

/** ① 死連結：相對路徑一律對著**所在檔的目錄**解析。 */
function scanLinks(root: string): ScanResult {
  let population = 0
  const hits: string[] = []
  for (const p of walkMd(root)) {
    // ⚠️ README 是「連結怎麼寫」那條規則的說明書，它舉的例子（`[](相對路徑)`）
    //    本來就不指向任何檔案。掃它等於把規則本身當成違規。
    if (basename(p) === 'README.md') continue
    const txt = readFileSync(p, 'utf8')
    for (const raw of matches(LINK, txt)) {
      if (/^(https?:|mailto:|#)/.test(raw)) continue
      const t = raw.split('#')[0]
      if (!t) continue
      population++
      // 🔴 規則①：基準是 dirname(p)，不是 root
      if (!existsSync(normalize(join(dirname(p), t)))) hits.push(`${relative(root, p)} -> ${t}`)
    }
  }
  return {
    name: '死連結',
    population,
    hits,
    note: '母體＝所有非 http 的 [](path)，而每一個都對著【它所在的那個目錄】解析。',
  }
}

function resolveTargets(root: string) {
  const names = new Set<string>()
  for (const d of SUBDIRS) {
    const dd = join(root, d)
    if (!existsSync(dd)) continue
    for (const fn of readdirSync(dd)) if (fn.endsWith('.md')) names.add(fn.replace(/\.md$/, ''))
    const ret = join(dd, 'retired')
    if (existsSync(ret)) {
      for (const fn of readdirSync(ret)) if (fn.endsWith('.md')) names.add(fn.replace(/\.md$/, ''))
    }
  }
  const sd = join(root, 'skills')
  const skills = new Set<string>(
    existsSync(sd) ? readdirSync(sd, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [],
  )
  // 🔴 三個入口檔 ＋ concepts／draft 的**小節標題**：一個指名可以指一個小節
  //    實測：`[[控制項登錄表]]` 指的是 draft/版面與檔案 §六之三 的標題
  const headFiles = ['experience.md', 'principles.md', 'vision.md'].map((f) => join(root, f))
  for (const d of ['concepts', 'draft'] as const) {
    const dd = join(root, d)
    if (existsSync(dd)) {
      for (const fn of readdirSync(dd)) if (fn.endsWith('.md')) headFiles.push(join(dd, fn))
    }
  }
  const heads = new Set<string>()
  for (const fp of headFiles) {
    if (!existsSync(fp)) continue
    for (const line of readFileSync(fp, 'utf8').split('\n')) {
      if (line.startsWith('#')) heads.add(line.replace(/^#+/, '').trim().replace(/^\*+|\*+$/g, '').trim())
    }
  }
  return { names, heads, skills }
}

/** ② 指名 `[[X]]`：三個命名空間 ＋ `history/NNN` 前綴形 ＋ 小節標題。 */
function scanNamed(root: string): ScanResult {
  const { names, heads, skills } = resolveTargets(root)
  const resolves = (x: string): boolean => {
    if (skills.has(x) || CORE.has(x) || heads.has(x) || PREFIXED.test(x)) return true
    for (const n of names) if (x === n || n.includes(x)) return true
    // 🔴 只認「指名是標題的一部分」這個方向。反向（標題是指名的一部分）會讓
    //    任何一個短標題（「元件」「套件」）吞下所有名字——實測 `[[元件套件管理]]`
    //    因此被判成解析得到，而它在庫裡沒有落點。
    //
    // > **一個放寬過的判準，它漏掉的東西與它抓到的東西長得一樣。**
    for (const h of heads) if (h.includes(x)) return true
    return false
  }
  let population = 0
  const bad = new Map<string, string[]>()
  for (const p of walkMd(root)) {
    if (basename(p) === 'README.md') continue // README 列的是範例
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const x of matches(NAMED, line.replace(INLINE_CODE, ''))) {
          const name = x.trim()
          if (CODEISH.test(name)) continue
          population++
          if (!resolves(name)) {
            const arr = bad.get(name) ?? []
            arr.push(`${relative(root, p)}:${i + 1}`)
            bad.set(name, arr)
          }
        }
      })
  }
  return {
    name: '死指名 [[X]]',
    population,
    hits: [...bad.entries()].sort().map(([x, l]) => `[[${x}]] ×${l.length}  ${l[0]}`),
    note: '命名空間＝concepts／draft／history／episodes 檔名 ＋ skills 目錄 ＋ 小節標題 ＋ NNN 前綴形。',
  }
}

/** ③ 孤兒：**兩種記法都要算**（`[](path)` 與 `[[指名]]`）。 */
function scanOrphans(root: string): ScanResult[] {
  const inbound = new Set<string>()
  const stems = new Map<string, string[]>() // 目錄 → 檔名（不含 .md）
  for (const d of SUBDIRS) {
    const dd = join(root, d)
    if (existsSync(dd)) stems.set(d, readdirSync(dd).filter((f) => f.endsWith('.md')))
  }
  for (const p of walkMd(root)) {
    const txt = readFileSync(p, 'utf8')
    for (const raw of matches(LINK, txt)) {
      if (/^(https?:|mailto:)/.test(raw)) continue
      const t = raw.split('#')[0]
      if (!t) continue
      const tgt = normalize(join(dirname(p), t))
      if (existsSync(tgt) && tgt !== p) inbound.add(tgt)
    }
    // 🔴 規則④：指名也算入連結
    for (const raw of matches(NAMED, txt)) {
      const x = raw.trim()
      for (const [d, files] of stems) {
        for (const fn of files) {
          const stem = fn.replace(/\.md$/, '')
          const prefixForm = new RegExp(`^${d}/0*${stem.slice(0, 3)}$`).test(x)
          if (x === stem || (x.length > 6 && stem.includes(x)) || prefixForm) {
            const tgt = join(root, d, fn)
            if (tgt !== p) inbound.add(tgt)
          }
        }
      }
    }
  }
  const NOTES: Record<string, string> = {
    draft: '「設計未決——出口是 vision 路線圖」那些零入連結是**對的**（未承諾庫存）。',
    history: '一筆 history 沒有人引用**不一定**是腐爛——而它也不會被任何人讀到。',
    concepts: '一顆概念沒有入連結，等於沒有任何一個主體在用它。',
    episodes: '一段情節沒有入連結，就沒有任何教訓指得回它的現場。',
  }
  const out: ScanResult[] = []
  for (const d of SUBDIRS) {
    const dd = join(root, d)
    if (!existsSync(dd)) continue
    const pool = readdirSync(dd)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .map((f) => join(dd, f))
    out.push({
      name: `孤兒（${d}）`,
      population: pool.length,
      hits: pool.filter((p) => !inbound.has(p)).map((p) => relative(root, p)),
      note: NOTES[d] ?? '',
      adjudicate: d === 'history',
    })
  }
  return out
}

/** ④ draft ↔ vision 雙向。 */
function scanDraftVision(root: string): ScanResult[] {
  const vis = readFileSync(join(root, 'vision.md'), 'utf8')
  // 🔴 「關鍵延伸」那張表的列（以 | 開頭）是**主題索引**，不是路線圖的升格引用。
  //    一份只被表格指到的 draft 不需要升格標記——第一版把三份這樣的誤報成 🔴。
  const body = vis
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('|'))
    .join('\n')
  const exists = (l: string) => existsSync(join(root, 'draft', l))
  const linked = new Set(matches(/draft\/([^)\]`\n]+\.md)/, body).filter(exists))
  const allLinked = new Set(matches(/draft\/([^)\]`\n]+\.md)/, vis).filter(exists))
  const head = (fn: string) =>
    readFileSync(join(root, 'draft', fn), 'utf8').split('\n').slice(0, 22).join('\n')

  const noMarker = [...linked].sort().filter((l) => !MARKERS.test(head(l)))
    .map((l) => `draft/${l}  ← vision 正文引用它而它沒說自己的狀態`)

  const ghost: string[] = []
  for (const fn of readdirSync(join(root, 'draft')).sort()) {
    if (!fn.endsWith('.md') || fn === 'README.md' || allLinked.has(fn)) continue
    const h = head(fn)
    const m = /(已升格|in-flight|已促成|設計理據)/.exec(h)
    if (m && h.includes('vision')) ghost.push(`draft/${fn}  自稱「${m[1]}」且提到 vision，而 vision 沒連它`)
  }
  const draftCount = readdirSync(join(root, 'draft')).filter((f) => f.endsWith('.md')).length
  return [
    {
      name: 'draft↔vision：被路線圖引用而沒說狀態',
      population: linked.size,
      hits: noMarker,
      note: '一份被 vision 正文引用的 draft 要說得出【它今天掛在哪一格上】。',
    },
    {
      name: 'draft↔vision：自稱 in-flight 而 vision 沒連',
      population: draftCount,
      hits: ghost,
      note: '⚠️ 這一項**判不了**：一句舊的「做完才退場」被下面的更正推翻時，兩句都還在檔裡。',
      adjudicate: true,
    },
  ]
}

/** ⑤ 子目錄 README。 */
function scanReadmes(root: string): ScanResult {
  const dirs = ['concepts', 'episodes', 'history', 'draft', 'skills']
  return {
    name: '子目錄 README',
    population: dirs.length,
    hits: dirs.filter((d) => !existsSync(join(root, d, 'README.md'))),
    note: '它替一個沒聽過 knowie 的第三者定向。',
  }
}

/** ⑥ skills 投影（規則③：退休讀 frontmatter 欄位，不 grep 全文）。 */
function scanSkills(root: string, repo: string): ScanResult {
  const sd = join(root, 'skills')
  const hits: string[] = []
  let population = 0
  for (const s of readdirSync(sd).sort()) {
    const sp = join(sd, s, 'SKILL.md')
    if (!existsSync(sp)) continue
    population++
    const retired = RETIRED_FIELD.test(readFileSync(sp, 'utf8'))
    for (const tool of ['.claude/skills', '.agents/skills']) {
      const proj = join(repo, tool, s)
      let there = false
      try {
        lstatSync(proj)
        there = true
      } catch {
        there = false
      }
      if (retired && there) hits.push(`${s}: 已退休而仍投影在 ${tool} → 它還載得進去（退休＝移除投影）`)
      else if (!retired && !there) hits.push(`${s}: 未退休而 ${tool} 沒有投影 → 補一個 symlink`)
    }
  }
  return {
    name: 'skills 投影',
    population,
    hits,
    note: '🔴 「退休」讀的是 frontmatter 的 status，不是 grep 全文——grep 會命中檔案裡的路徑清單。',
  }
}

export function scanKnowledge(repoRoot: string): ScanResult[] {
  const root = join(repoRoot, 'knowledge')
  return [
    scanLinks(root),
    scanNamed(root),
    ...scanOrphans(root),
    ...scanDraftVision(root),
    scanReadmes(root),
    scanSkills(root, repoRoot),
  ]
}

/** 機械確定的發現（不含 🟡 要人再判的）。 */
export function mechanicalHits(results: ScanResult[]): string[] {
  return results.filter((r) => !r.adjudicate).flatMap((r) => r.hits.map((h) => `${r.name}｜${h}`))
}

/** 母體為 0 的項目——**那是路徑寫錯了，不是它乾淨了**。 */
export function emptyPopulations(results: ScanResult[]): string[] {
  return results.filter((r) => r.population === 0).map((r) => r.name)
}

export function formatReport(results: ScanResult[]): string {
  const lines: string[] = []
  for (const r of results) {
    const mark = r.hits.length === 0 ? '🟢' : r.adjudicate ? '🟡' : '🔴'
    const tail = r.adjudicate && r.hits.length ? '（🟡 要人再判）' : ''
    lines.push(`${mark} ${r.name}：母體 ${r.population}，發現 ${r.hits.length}${tail}`)
    if (r.note) lines.push(`   ⚠️ ${r.note}`)
    for (const h of r.hits) lines.push(`   · ${h}`)
  }
  return lines.join('\n')
}
