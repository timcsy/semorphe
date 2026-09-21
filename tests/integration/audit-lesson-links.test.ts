/**
 * 第一百三十條護欄：**課文頁上的每一條連結，按下去要真的有東西**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，其中一個逐字：
 *
 * > 我覺得網站有一些bug**有一些案下去不會到他寫的部分**。
 * > 網站疑時很完善了只是有一些感覺太擠其他還可。
 *
 * ⚠️ **那句話含糊到沒辦法直接修**——它可能是任何一顆按鈕。
 * 而把出站的 78 份 HTML 掃過（977 條站內連結）之後，
 * **指不到任何檔案的剛好有一條**：
 *
 * ```
 * cpp-advanced/06-Linked List  →  ../../c-bridge/03-指標/lesson.md   🔴 404
 * ```
 *
 * 🔴 **兩邊各自都是對的，而它們對的是不同的東西**：
 *
 * ```
 * 在 repo 裡讀 markdown   那條相對路徑指到另一份 lesson.md      🟢 按得到
 * 出站之後                那個位置是一個資料夾 ＋ index.html    🔴 按不到
 * ```
 *
 * > **一條在來源裡正確的相對路徑，在投影之後指到的是投影的形狀
 * > ——而沒有人會去按來源。**
 *
 * ## 判準
 *
 * 產生器吐出來的每一頁，它的**站內** `href` 都要落在
 * 「這次 build 真的會產出的東西」那個集合裡：
 *
 * ```
 * 課文頁        lessonDocHref(每一課)
 * 軌道頁／索引  BASE + lessons/<軌道>/ · BASE + lessons/
 * 編輯器        BASE（`?lesson=…&task=…` 的 query 由第 123 條顧）
 * 其餘          repo 裡真的有那個檔（favicon、規格頁…）
 * ```
 *
 * ## ⚠️ 這條是硬性零，不是棘輪
 *
 * 「留一筆還成立嗎」→ 不成立：一條 404 的連結，**每一個按到它的人都會撞到**，
 * 而它在畫面上與一條好的連結長得一模一樣。
 * 「修法貴不貴」→ 一行（走 `lessonDocHref`，那是既有的唯一對應）。
 *
 * ## 本檔不檢測什麼
 *
 * - **不讀 `dist/`**——它跑產生器自己那幾支純函式（同 `audit-lesson-pages`），
 *   所以不必先 build。⚠️ 代價是它看不到「檔案沒被複製進 dist」那一類。
 * - **不檢查外部連結**（`https://…`）——那要連網，而它會在別人的站掛掉時紅。
 * - **不檢查 query 指到的題目在不在**——那是第 123 條 `lesson-task-entry` 的事。
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readTracks, readLessonsOf, readTargets } from '../../tools/build-lessons/read-lessons'
import { renderIndex, renderTrack, renderLesson, renderSpecs } from '../../tools/build-lessons/render'
import { lessonDocHref } from '../../src/core/lesson/lesson'
import { printReport } from '../helpers/guardrail'

const ROOT = resolve(__dirname, '../..', 'lessons')
const REPO = resolve(__dirname, '../..')

interface Page { id: string; html: string }

/**
 * ⚠️ **兩邊都要 decode 再比**：`lessonDocHref` 會把中文課名 percent-encode，
 * 而頁面上的 `href` 也是。第一版只 decode 了讀到的那一側，於是
 * **195 條正常的上一課／下一課全被報成壞的**——看起來像找到了一片災難。
 *
 * > **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**
 */
const norm = (u: string): string => decodeURIComponent(u.split('#')[0].split('?')[0])

/** 產生器那一側看到的所有頁 ＋ build 真的會產出的網址。 */
function build(): { pages: Page[]; willExist: Set<string> } {
  const pages: Page[] = []
  const willExist = new Set<string>()
  const counts: Parameters<typeof renderIndex>[0][number][] = []
  for (const track of readTracks(ROOT)) {
    const ps = readLessonsOf(ROOT, track)
    ps.forEach((p, i) => {
      pages.push({ id: p.lesson.id, html: renderLesson(p, { prev: ps[i - 1], next: ps[i + 1] }) })
      willExist.add(norm(lessonDocHref(p.lesson.id)))
    })
    pages.push({ id: `軌道:${track.id}`, html: renderTrack(track, ps) })
    counts.push({ track, count: ps.length })
  }
  pages.push({ id: '索引', html: renderIndex(counts) })
  const specs = renderSpecs(readTargets(REPO))
  pages.push({ id: '規格', html: specs })
  // 🟢 **規格頁的網址問它自己**（`<link rel=canonical>`）——不要在這裡再寫一次
  //    `/lessons/specs/`。手抄一份的話，那一天它搬家，這條護欄會說它 404。
  const canon = specs.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
  if (canon !== undefined) willExist.add(norm(canon.replace(/^https?:\/\/[^/]+/, '')))
  // 🟢 軌道頁／索引／編輯器的網址，抄產生器寫它們用的那一份（見 `renderLesson` 的麵包屑）。
  const base = lessonDocHref('x/y').replace(/lessons\/x\/y\/$/, '')
  willExist.add(norm(base))
  willExist.add(norm(`${base}lessons/`))
  for (const t of readTracks(ROOT)) willExist.add(norm(`${base}lessons/${t.id}/`))
  return { pages, willExist }
}

/** 一條 href 落在哪裡。`null` ＝ 沒問題；字串 ＝ 為什麼不行。 */
function whyBroken(href: string, willExist: Set<string>): string | null {
  if (/^(https?:|mailto:|#|data:)/.test(href)) return null   // 外部，見檔頭「不檢測什麼」
  const path = norm(href)
  if (path === '') return null
  if (willExist.has(path)) return null
  // 🟢 其餘的要在 repo 的 `public/` 裡真的有那個檔（favicon 那一族）。
  const asRepoFile = resolve(REPO, 'public', path.replace(/^\//, ''))
  if (existsSync(asRepoFile)) return null
  // 🔴 **刻意沒有「repo 根目錄下有這個檔就算數」那一條**：
  //    `/lessons/c-bridge/03-指標/lesson.md` 在 repo 裡【真的存在】，
  //    而出站之後那個位置是資料夾——加了那條退路，這條護欄就對它自己的
  //    誕生原因瞎了。（注入①正是在守這件事。）
  return path
}

describe('第一百三十條護欄：課文頁上的每一條連結，按下去要真的有東西', () => {
  const { pages, willExist } = build()

  it('★ 入口條件：真的產出頁了', () => {
    // 不可省。`pages` 是空的話，下面那條硬性零在驗空集合——而它會是綠的。
    expect(pages.length, '一頁都沒產出 → 產生器壞了，不是課文沒有連結').toBeGreaterThan(60)
  })

  it('★ 入口條件：真的掃到連結了', () => {
    const n = pages.reduce((a, p) => a + [...p.html.matchAll(/href="([^"]+)"/g)].length, 0)
    expect(n, '一條 href 都沒掃到 → 那個正規式壞了').toBeGreaterThan(500)
  })

  it('🔴 硬性零：站內的連結都指得到東西', () => {
    const broken: string[] = []
    let internal = 0
    for (const p of pages) {
      for (const m of p.html.matchAll(/href="([^"]+)"/g)) {
        const href = m[1]
        if (/^(https?:|mailto:|#|data:)/.test(href)) continue
        internal++
        const why = whyBroken(href, willExist)
        if (why !== null) broken.push(`${p.id}  →  ${why}`)
      }
    }
    printReport('課文頁上的連結', [
      `產出的頁     ${pages.length}`,
      `站內連結     ${internal}`,
      `🔴 指不到東西 ${broken.length}  ← 硬性零`,
      ...[...new Set(broken)].map((b) => `  ${b}`),
    ])
    expect(
      [...new Set(broken)],
      '一條 404 的連結，在畫面上與一條好的連結長得一模一樣',
    ).toEqual([])
  })

  it('★ 注入：一條指到 lesson.md 的連結必須被認出來', () => {
    // 🔴 這一條餵的是**合成的**路徑——不靠任何一課真的壞掉。
    //    偵測器壞掉的話，上面那條硬性零會在每一條都壞的時候全綠。
    expect(
      whyBroken('/lessons/c-bridge/03-%E6%8C%87%E6%A8%99/lesson.md', willExist),
      '認不出出站之後那個位置是資料夾而不是 lesson.md',
    ).not.toBeNull()
  })

  it('★ 注入：而一條真的課文連結不得被報成壞的', () => {
    // ⚠️ 擋的是「把每一條都報成壞的」那種壞法。
    const one = readLessonsOf(ROOT, readTracks(ROOT)[0])[0]
    expect(whyBroken(lessonDocHref(one.lesson.id), willExist), '把對的報成錯的').toBeNull()
  })

  it('★ 注入：外部連結不在這條護欄的職權內', () => {
    expect(whyBroken('https://github.com/timcsy/semorphe', willExist)).toBeNull()
  })
})
