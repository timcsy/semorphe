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
