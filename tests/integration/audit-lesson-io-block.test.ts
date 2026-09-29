/**
 * 護欄：**「印出來長這樣」那個框裡，不得混進餵給程式的輸入。**
 *
 * ## 🔴 它從哪來（2026-09-29，使用者看著頁面說的）
 *
 * 第 6 課〈換你了〉長這樣：
 *
 * ```
 * 輸入：14
 * 兩倍是 28
 * 餘數是 2
 * ```
 *
 * > 「這裡的輸入很容易讓人以為要顯示『輸入：』」
 *
 * 而那是對的：`14` 是**餵進去的**，`兩倍是 28` 是**印出來的**，
 * 兩者擠在同一個框裡，而框的意思是「你的程式要印出這些」。
 *
 * > **一個框如果同時裝著【餵進去的】與【印出來的】，
 * > 讀者只能靠猜——而他會照著框裡的每一行去印。**
 *
 * ## 體例（全庫多數課本來就這樣寫）
 *
 * ```
 * 裁判餵 `1 2 3` 進去，印出來要長這樣：      ← 輸入寫在【散文】裡
 *
 * ```
 * 3
 * 2
 * 1
 * ```                                      ← 框裡只有印出來的
 * ```
 *
 * 實測：全庫 69 課裡只有 **2 課**用了混在一起的寫法（2026-09-29 都改了）。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果掃到的課數是 0，代表路徑寫錯了，不是每一課都乾淨。**
 * 錨在**掃到幾課**（輸入量）上——刻意不錨在「還有幾個混在一起的框」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管標了語言的圍籬**（```cpp 之類）——那是程式碼不是輸出樣本。
 * - **不管散文**怎麼描述輸入（那正是體例要的位置）。
 * - 不檢查框裡的輸出對不對（那是 `audit-lesson-answers-vs-compiler` 的地盤）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
/** 「這一行在宣告它是輸入」的寫法。⚠️ 只認行首——散文裡提到「輸入」是正當的。 */
const IO_LABEL = /^\s*(輸入|輸出|stdin|stdout|Input|Output)\s*[：:]/

function lessons(): string[] {
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

/** 沒有標語言的圍籬——那就是「印出來長這樣」的框。 */
function plainFences(md: string): { line: number; body: string[] }[] {
  const lines = md.split('\n')
  const out: { line: number; body: string[] }[] = []
  let open = false
  let plain = false
  let start = 0
  let buf: string[] = []
  lines.forEach((l, i) => {
    if (l.startsWith('```')) {
      if (!open) { open = true; plain = l.trim() === '```'; start = i + 1; buf = [] }
      else { open = false; if (plain && buf.length > 0) out.push({ line: start, body: buf }) }
      return
    }
    if (open) buf.push(l)
  })
  return out
}

const files = lessons()

describe('護欄：輸出的框裡不得混進輸入', () => {
  it('★ 入口條件：讀到的課不得為零', () => {
    expect(files.length, '🔴 一課都沒讀到 → 路徑寫錯了，下面的零是假的').toBeGreaterThan(50)
  })

  it('★ 入口條件：真的抓得到那種框（否則下面在掃空集合）', () => {
    const n = files.reduce((a, f) => a + plainFences(fs.readFileSync(f, 'utf8')).length, 0)
    expect(n, '🔴 一個沒標語言的圍籬都沒抓到 → 解析壞了').toBeGreaterThan(30)
  })

  it('🔴 硬性零：沒標語言的框裡，不得有「輸入：」這種標籤', () => {
    const bad: string[] = []
    for (const f of files) {
      for (const fence of plainFences(fs.readFileSync(f, 'utf8'))) {
        fence.body.forEach((l, k) => {
          if (IO_LABEL.test(l)) {
            bad.push(`${path.relative(ROOT, f)}:${fence.line + k}  ${l.trim().slice(0, 40)}`)
          }
        })
      }
    }
    expect(
      bad,
      '\n🔴 這些框同時裝著【餵進去的】與【印出來的】，讀者會照著每一行去印：\n' + bad.join('\n')
        + '\n\n處置：把輸入搬進散文（「裁判餵 `X` 進去，印出來要長這樣：」），框裡只留輸出。\n',
    ).toEqual([])
  })

  it('★ 注入：合成一個混在一起的框 → 判準要認得出來', () => {
    for (const l of ['輸入：14', '  輸出: 3', 'Input: 5', 'stdin：1 2 3']) {
      expect(IO_LABEL.test(l), `認不出「${l}」`).toBe(true)
    }
  })

  it('★ 不亂報：正當的輸出行與散文不得被報', () => {
    for (const l of ['兩倍是 28', '3', '分數是 100', '這一題的輸入：14 寫在散文裡是對的']) {
      expect(IO_LABEL.test(l), `誤報「${l}」`).toBe(false)
    }
  })
})
