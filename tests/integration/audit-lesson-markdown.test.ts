/**
 * 護欄：**課文頁上不得看得到字面的 `**`。**
 *
 * ## 🔴 它從哪來（2026-09-29，使用者看著頁面說的）
 *
 * 我在第 6 課加了一句 `🔴 **這才是〈跟著做〉要交的那一支。**第三、四節…`，
 * 而頁面上印出來是**兩顆星號**，沒有粗體。
 *
 * ## 判準是 CommonMark 的 flanking 規則，而中文標點剛好踩在它上面
 *
 * ```
 * a**「x」**的 b     →  a**「x」**的 b     ❌ 星號原樣印出來
 * a「**x**」的 b     →  a「<strong>x</strong>」的 b   ✅
 * ```
 *
 * 收尾的 `**` 要能收尾，必須「前面不是空白」**而且**
 * 「前面不是標點，或者後面是空白／標點」。
 * 中文的 `」`、`。` 都是標點，而它們後面常常直接接中文字
 * ⟹ **那個 `**` 收不了尾，整段粗體失敗。**
 * 開頭那一側對稱：`在**「…` 的 `**` 後面是 `「`（標點）、前面是中文字 ⟹ 開不了頭。
 *
 * > **一個標記語言的規則寫給空白分詞的語言，
 * > 而中文把標點直接貼在字上——於是它在中文裡的失敗是【安靜地印出原始碼】。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果掃到的課數是 0，代表路徑寫錯了，不是每一課都乾淨。**
 * 錨在**掃到幾課**（輸入量）上，不錨在「還有幾個星號」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管程式碼裡的 `**`**（Python 的次方就是它）——`<code>`／`<pre>` 一律挖掉。
 *   ⚠️ 第一版的掃描只挖了 `<pre>`，於是把 `` `**` `` 這個**正確的寫法**報成缺陷。
 * - 不管其他 markdown 記號（`_`、`*` 單星）——它們在這個庫裡沒有出現過這個病。
 * - 不檢查粗體用得對不對，只檢查**它有沒有生效**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import MarkdownIt from 'markdown-it'

const ROOT = path.resolve(__dirname, '../..')
const md = new MarkdownIt({ html: true })

function lessonFiles(): string[] {
  const base = path.join(ROOT, 'lessons')
  const out: string[] = []
  for (const track of fs.readdirSync(base)) {
    const td = path.join(base, track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const d of fs.readdirSync(td)) {
      const f = path.join(td, d, 'lesson.md')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out
}

/** 渲染之後，把程式碼那幾種標籤挖掉——它們裡面的 `**` 是正當的。 */
function proseOf(mdText: string): string {
  return md.render(mdText)
    .replace(/<pre[\s\S]*?<\/pre>/g, '')
    .replace(/<code[\s\S]*?<\/code>/g, '')
}

const files = lessonFiles()

describe('護欄：課文頁上不得看得到字面的 **', () => {
  it('★ 入口條件：讀到的課不得為零', () => {
    expect(files.length, '🔴 一課都沒讀到 → 路徑寫錯了，下面的零是假的').toBeGreaterThan(50)
  })

  it('★ 注入：CommonMark 的行為就是這樣（不是我記錯）', () => {
    expect(proseOf('a**「x」**的 b'), '判準的前提不成立了').toContain('**')
    expect(proseOf('a「**x**」的 b'), '正確的寫法被判成壞的').not.toContain('**')
  })

  it('🔴 硬性零：渲染之後，散文裡不得留下 **', () => {
    const bad: string[] = []
    for (const f of files) {
      const prose = proseOf(fs.readFileSync(f, 'utf8'))
      if (!prose.includes('**')) continue
      const rel = path.relative(ROOT, f)
      for (const m of prose.matchAll(/\*\*/g)) {
        const seg = prose.slice(Math.max(0, m.index - 36), m.index + 26)
          .replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
        bad.push(`${rel}  …${seg}…`)
      }
    }
    expect(
      bad,
      '\n🔴 這些地方的粗體沒有生效，頁面上印的是兩顆星號：\n' + bad.join('\n')
        + '\n\n處置：把 `**` 移到中文標點的【裡面】——`在「**x**」那部分` 而不是 `在**「x」那部分**`。\n',
    ).toEqual([])
  })
})

/**
 * **同一族的另外兩個：markdown 的失敗是安靜的**（2026-10-05，使用者看著頁面說的：
 * 「格式跑掉」「不要同一行」）。
 *
 * ```
 * ① 表格少了分隔列（|---|---|）   GFM 不認它是表格 ⟹ 頁面上印一串 | 和文字
 * ② 會變成積木的程式碼（demo／counter）一行放好幾個敘述
 *    ⟹ 程式碼那一邊擠在一行;而更糟的是並排時第二欄落進【註解】裡:
 *       cout << q.front();  // 1       cout << st.top();  // 2
 *                                      ~~~~~~~~~~~~~~~~~~ 這一句被 // 吃掉,積木那一邊根本沒有它
 * ```
 *
 * ⚠️ ②只管 `demo`／`counter` 這兩種會投影成積木的區塊。一般的 ```` ``` ```` 區塊裡
 * 並排註解是**刻意的**（第 2、6、11 課都有，`int n = 1;  ←→  int i = 1` 那種）。
 *
 * ⚠️ 判準量過誤報：`for (int i = 0; i < n; i++)` 的分號在括號裡（先挖掉括號）；
 * `// ← 忘了 n = n + 1;` 是正當的註解（只抓「註解之後空三格以上再接一個敘述」的並排形狀）。
 * 修之前恰好抓到使用者看到的那三處，修之後是零。
 */
const stripParens = (s: string): string => {
  let prev: string
  do { prev = s; s = s.replace(/\([^()]*\)/g, '()') } while (s !== prev)
  return s
}

/** 一行 C／C++ 程式碼的兩種毛病：同一行多個敘述、註解裡藏著並排的敘述。 */
export function demoLineProblems(line: string): string[] {
  const k = line.indexOf('//')
  const code = k < 0 ? line : line.slice(0, k)
  const comment = k < 0 ? '' : line.slice(k)
  const out: string[] = []
  if (/;\s*[^\s}]/.test(stripParens(code))) out.push('同一行多個敘述')
  if (/^\/\/.*\S\s{3,}\S[^;]*;/.test(comment)) out.push('註解裡藏著並排的敘述')
  return out
}

/** 一段 inline 內容看起來是「沒被認成表格的表格」。 */
const looksLikeBrokenTable = (content: string): boolean => /^\|/.test(content) && /\n\|/.test(content)

describe('護欄：markdown 安靜失敗的另外兩種——表格與會變成積木的程式碼', () => {
  it('★ 注入：兩種毛病都抓得到，而合法的寫法不被誤報', () => {
    expect(demoLineProblems('n += 5;    n -= 3;')).toContain('同一行多個敘述')
    expect(demoLineProblems('cout << q.front();  // 1       cout << st.top();  // 2'))
      .toContain('註解裡藏著並排的敘述')
    expect(demoLineProblems('for (int i = 0; i < n; i++) {'), 'for 的分號被誤報').toEqual([])
    expect(demoLineProblems('    // ← 忘了 n = n + 1;'), '正當的註解被誤報').toEqual([])
    expect(demoLineProblems('n += 5;        // 完全等於 n = n + 5;'), '行尾說明被誤報').toEqual([])
    const tokens = md.parse('| a | b |\n| c | d |\n', {})
    expect(tokens.some((t) => t.type === 'inline' && looksLikeBrokenTable(t.content)), '少分隔列的表格沒被抓到').toBe(true)
    expect(md.parse('| a | b |\n|---|---|\n| c | d |\n', {}).some((t) => t.type === 'table_open'), '正確的表格沒被認出').toBe(true)
  })

  it('🔴 硬性零：表格都要有分隔列；demo／counter 的程式碼一行一個敘述', () => {
    const bad: string[] = []
    let fences = 0
    for (const f of files) {
      const rel = path.relative(ROOT, f)
      for (const tk of md.parse(fs.readFileSync(f, 'utf8'), {})) {
        if (tk.type === 'inline' && looksLikeBrokenTable(tk.content)) {
          bad.push(`${rel}:${(tk.map?.[0] ?? 0) + 1}  表格少了分隔列（|---|---|），頁面上會印成一串 |`)
        }
        if (tk.type === 'fence' && /^(c|cpp)\b.*\b(demo|counter)\b/.test(tk.info)) {
          fences++
          tk.content.split('\n').forEach((l, i) => {
            for (const p of demoLineProblems(l)) bad.push(`${rel}:${(tk.map?.[0] ?? 0) + 2 + i}  ${p}：${l.trim()}`)
          })
        }
      }
    }
    // 入口條件：demo／counter 區塊一個都沒掃到的話，下面的零是假的
    expect(fences, '🔴 一個 demo／counter 區塊都沒掃到 —— info 字串的判準寫錯了').toBeGreaterThan(20)
    expect(bad, '\n🔴 這些地方在頁面上會跑掉：\n' + bad.join('\n') + '\n').toEqual([])
  })
})
