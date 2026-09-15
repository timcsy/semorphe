/**
 * **第一百三十條護欄：課文的強調，要留得出喘息的地方。**
 *
 * ## 它從哪來——一個學生的一句話（2026-09-15）
 *
 * > 「雖然中間的文字寫得有點難理解，但整體**講得很詳細**，做起來滿輕鬆的」
 *
 * 「詳細」與「難理解」不是矛盾，它們很可能是**同一個原因**。量出來的：
 *
 * ```
 * 沒有被標記過的文字，一段中位 14 字       而一句中文是 20–25 字
 * 全庫 69 課的全距只有 9–22               → 不是幾課走鐘，是文體
 * 小節中位 71 字，781 節裡 538 節不到百字   → 不是長段落，是【一直被打斷】
 * ```
 *
 * > **當每三個詞就有一個被標成重點，讀者就建不出層次——他只好每一句都用力讀。
 * > 那讀起來正是「很詳細」而且「有點難理解」。**
 *
 * ## 🔴 而這個維度在此之前【沒有人數著】，所以它一直在長胖
 *
 * 那些多出來的強調不是憑空來的。舉一個查得到來源的：第 2 課「四種基本型別」
 * 那一節裡的「`//` 是註解」，是「課文用了還沒教過的東西」那次稽核（63 筆）
 * 補進去的——而它加在**最近的那一節**，不是加在它自己的位置。
 *
 * > **一個只錨住「正確性」的檢查，它的修法會在「可讀性」那一側收費
 * > ——而那一側沒有人數著。**
 *
 * ## 這一條量兩件事，一硬一軟
 *
 * ```
 * 硬性零   程式碼註解與表格【逐字】說同一句話   ——那是冗餘效應，它扣分
 * 棘輪     中位喘息不到一句話的課數            ——只准降，因為 69 課清不完
 * ```
 *
 * ⚠️ **門檻 20 字不是挑一個好看的數字**：它是量出來的——這幾課的句長中位是
 * 22–27 字，取一個「至少讀得完一個短句」的下界。
 *
 * ## ⚠️ 本護欄不檢測什麼
 *
 * - **不檢測寫得好不好**——它只數強調之間有多少字。一段沒有任何強調的爛文章
 *   在這裡是滿分。
 * - **不碰引言（`>`）裡的粗體**。查證過課文頁的樣式：
 *   `blockquote` 的文字色是 `var(--muted)`——**引言是灰的**，裡面的粗體不是
 *   第二層強調，它是那句話唯一的可讀性來源。
 *   > **一個「這裡重複標了兩次」的判斷，要先去看那兩層【在畫面上長什麼樣】。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadBaseline, assertRatchet } from '../helpers/guardrail'

const ROOT = path.resolve(__dirname, '../..')

/** 一句中文的下界——**量出來的**，見檔頭。 */
const ONE_SENTENCE = 20

/**
 * 🪦 **字面的三連反引號不能寫在這個檔裡**——它會讓整個檔的反引號配對錯開，
 * 而錯開的配對會生出橫跨數十行的假「程式碼片段」。
 * 那些片段被第三十一／七十二條護欄當成 C++ 語料吃進去（實測 +3 段）。
 *
 * > **一個測試檔的【排版】會變成另一條護欄的【輸入】
 * > ——而它污染的是一份用來量誤差的語料。**
 *
 * ⚠️ 同理，這個檔裡的正則用 `\x60` 而不寫字面的反引號：一行奇數個反引號
 * 就會讓後面整個檔的配對錯開一位（實測行 65／85／115 各一處）。
 */
const FENCE = '\x60'.repeat(3)

function lessonFiles(): string[] {
  const out: string[] = []
  const lessons = path.join(ROOT, 'lessons')
  for (const track of fs.readdirSync(lessons)) {
    const td = path.join(lessons, track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const l of fs.readdirSync(td)) {
      const f = path.join(td, l, 'lesson.md')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

/** 課文裡真正是「散文」的那些字——⚠️ 扣掉程式碼、表格列、行內等寬。 */
function prose(md: string): string {
  const noCode = md.replace(/```[\s\S]*?```/g, '')
  const noTable = noCode.split('\n').filter((l) => !l.trim().startsWith('|')).join('\n')
  return noTable.replace(/\x60[^\x60]*\x60/g, '')
}

/**
 * 兩個強調之間，讀者能一口氣讀完的字數。
 *
 * 🔴 **粗體【整段】算界標，不是把它的內部當喘息**——`**四種基本型別**`
 * 的那六個字不是休息，它本身就是強調。第一版把它算進去，量出來的數字
 * 整整大了一半。
 */
export function plainRuns(text: string): number[] {
  // 🪦 **界標不能用空白**：課文裡本來就有空白（`⏱ 約 15 分鐘`），於是每一個
  //    空格都被當成一次打斷——同一份課文，這裡量出 69 課不合格而另一支量出 58。
  //
  // > **兩份實作對不上的時候，先找出哪一份錯了——調基線是把錯的那一份寫進歷史。**
  const SEP = '\u0000'
  const t = text
    .replace(/\*\*[\s\S]+?\*\*/g, SEP)
    .replace(/^\s*> .*$/gm, SEP)
    .replace(/⚠️|🔴|🟢|🪦|🎯|🎬|🟠|——/g, SEP)
  return t.split(SEP).map((p) => p.replace(/\s/g, '').length).filter((n) => n > 0)
}

function medianRun(md: string): number {
  const r = plainRuns(prose(md)).sort((a, b) => a - b)
  return r.length === 0 ? 0 : r[Math.floor(r.length / 2)]
}

// ── 冗餘：程式碼註解與表格逐字說同一句話 ───────────────────────────────

const norm = (s: string): string => s.replace(/[\x60*＊\s，。、（）()：:—\-|]+/g, '')

function longestCommon(a: string, b: string): number {
  let best = 0
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best) best = cur[j]
      }
    }
    prev = cur
  }
  return best
}

export interface Redundancy { lesson: string; section: string; comment: string; cell: string }

/**
 * 一節裡，哪幾句程式碼註解與表格的某一格**說的是同一句話**。
 *
 * ⚠️ 兩條讓它不亂報的規矩，兩條都是被偽陽性教出來的：
 *
 * ```
 * 跳過表格第一欄     那是【鍵】——註解寫著同一個鍵是交叉參照（`# str` ↔ `| str |`）
 * 兩邊的比例都要夠   只看註解那一邊的話，短註解會對上一格長說明
 *                   （實測：`改第一個` 對上 `拿掉第一個等於 v 的`）
 * ```
 */
export function redundancies(md: string, lesson = ''): Redundancy[] {
  const out: Redundancy[] = []
  const secs = [...`\n${md}`.matchAll(/\n#{2,3} ([^\n]+)\n([\s\S]*?)(?=\n#{2,3} |$)/g)]
  for (const [, title, body] of secs) {
    const cells: string[] = []
    for (const l of body.split('\n')) {
      if (!l.trim().startsWith('|')) continue
      if (/^\s*\|[\s|:-]+\|\s*$/.test(l)) continue
      cells.push(...l.trim().replace(/^\||\|$/g, '').split('|').slice(1).map(norm))
    }
    const usable = cells.filter((c) => c.length >= 4)
    if (usable.length < 2) continue
    for (const block of body.match(/```[\s\S]*?```/g) ?? []) {
      for (const m of block.matchAll(/(?:\/\/|#)\s*(\S[^\n]*)/g)) {
        const n = norm(m[1])
        if (n.length < 4) continue
        for (const cell of usable) {
          const L = longestCommon(n, cell)
          if (Math.min(L / n.length, L / cell.length) >= 0.6) {
            out.push({ lesson, section: title.trim(), comment: m[1].trim(), cell })
            break
          }
        }
      }
    }
  }
  return out
}

describe('第一百三十條護欄：課文的強調要留得出喘息', () => {
  const files = lessonFiles()

  it('★ 入口條件：真的掃到課文了', () => {
    expect(files.length, '🔴 一課都沒掃到 → 下面每一條都在驗空集合').toBeGreaterThan(50)
  })

  it('★ 硬性零：程式碼註解不得與表格逐字說同一句話', () => {
    const hits = files.flatMap((f) =>
      redundancies(fs.readFileSync(f, 'utf8'), path.basename(path.dirname(f))))
    expect(
      hits.map((h) => `${h.lesson} · ${h.section} · 「${h.comment}」≈「${h.cell}」`),
      '🔴 同一份資訊兩種排版——留一個就好（認知負荷理論的冗餘效應）：',
    ).toEqual([])
  })

  it('★ 棘輪：中位喘息不到一句話的課數，只准下降', () => {
    const below = files.filter((f) => medianRun(fs.readFileSync(f, 'utf8')) < ONE_SENTENCE)
    assertRatchet([['喘息不足一句的課數', below.length]], 'lesson-emphasis')
  })

  it('★ 注入①：一句與表格重複的註解 → 要被報出來', () => {
    const md = [
      '## 一、測試',
      FENCE + 'cpp',
      'int x = 1;      // 把 x 設成一',
      FENCE,
      '| 寫法 | 做什麼 |',
      '|---|---|',
      '| `x = 1` | 把 x 設成一 |',
      '| `y = 2` | 把 y 設成二 |',
    ].join('\n')
    expect(redundancies(md).length, '🔴 逐字重複沒被報 → 偵測器壞了').toBe(1)
  })

  it('★ 注入②：註解寫的是表格的【鍵】→ 不得被報（那是交叉參照）', () => {
    // 🔴 這一條擋的是實際踩過的偽陽性：`# str` 對上表格的 `| str |`
    const md = [
      '## 一、測試',
      FENCE + 'python',
      'name = "小明"      # str',
      FENCE,
      '| | 長什麼樣 |',
      '|---|---|',
      '| `str` | 有引號的那一種 |',
      '| `int` | 沒有小數點的 |',
    ].join('\n')
    expect(redundancies(md), '🔴 交叉參照被當成重複 → 護欄會逼人刪掉有用的東西').toEqual([])
  })

  it('★ 注入③：把一段的強調加密 → 中位喘息要掉下來', () => {
    const plain = '這是一段沒有任何強調的文字'.repeat(6)
    const dense = '這是一段**沒有**任何**強調**的文字'.repeat(6)
    expect(medianRun(plain)).toBeGreaterThanOrEqual(ONE_SENTENCE)
    expect(medianRun(dense), '🔴 加密了而量不出來 → 這條棘輪擋不住任何事').toBeLessThan(ONE_SENTENCE)
  })

  it('★ 粗體的【內部】不算喘息', () => {
    // 🪦 第一版把它算進去，量出來的數字整整大了一半
    expect(plainRuns('**一二三四五六七八九十**')).toEqual([])
  })

  it('★ 基線裡真的有這一項（少一項＝棘輪沒跑而測試是綠的）', () => {
    const base = loadBaseline<Record<string, number>>('lesson-emphasis')
    expect(typeof base['喘息不足一句的課數']).toBe('number')
  })
})
