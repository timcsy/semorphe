/**
 * 把 `lessons/` 讀成宣告——**建置期那一側的搬運工**。
 *
 * ## 🔴 它與 `src/core/load-lessons.ts` 的關係
 *
 * 那一支用 `import.meta.glob`，只在 Vite 的模組圖裡跑得動；這一支跑在 Node 裡。
 * 所以**搬運不同，理解相同**：
 *
 * ```
 * 這一支負責   把 bytes 拿進來（fs）           ← 允許不一樣
 * 兩支共用     parseTrack / parseLesson / order 排序   ← 【必須】一樣
 * ```
 *
 * > **一份宣告的第二個讀者，危險的不是它怎麼拿到檔案，
 * > 是它自己解釋那份檔案。**
 *
 * ⚠️ 而「兩邊看到的課一樣多」不是靠這段註解保證的——
 * `tests/integration/audit-lesson-pages.test.ts` 拿**登錄表**（glob 那一側）
 * 去對 `dist/` 裡的頁數，對不上就紅。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { parseLesson, parseTrack, type Lesson, type Track } from '../../src/core/lesson'

export interface LessonPage {
  readonly lesson: Lesson
  readonly track: Track
  /** `lesson.md` 的原文——⚠️ 課文只有這一份，不在 `lesson.json` 裡 */
  readonly md: string
  /**
   * 課文**最後一次被改**的時間——`sitemap.xml` 的 `lastmod` 用它。
   *
   * 🔴 **問 git，不問檔案的 mtime**（2026-09-03，CI 紅了才發現）：
   * `git clone` 之後每個檔的 mtime 都是 **checkout 的時間**，於是在 CI 上
   * 「每一課的最後修改日」會全部變成今天——**那正是這個欄位最沒有用的樣子**。
   *
   * ⚠️ 問不到就是 `undefined`（不是「今天」）：`lastmod` 可以不寫，
   * 但不可以寫一個假的——Google 會學會不看它。
   */
  readonly lastmod?: Date
  /**
   * **程式碼 ↔ 積木的逐行對照**——`tools/demo/record-blockmaps.spec.ts` 產的。
   *
   * 🔴 使用者 2026-09-04：「我比較在意的是程式碼跟積木或是節點的對照，
   * **目前使用者幾乎沒有辦法從課程了解積木長怎樣**」。
   *
   * ⚠️ 沒有就是 `undefined`（那一課的頁少一塊，而不是整個建置失敗）
   * ——⚠️ 而**「少了」與「過期了」都由護欄盯**
   * （`tests/integration/audit-lesson-blockmaps.test.ts`），不是靠這裡。
   */
  readonly blockmap?: BlockMap
}

/** 一課的對照：那張 SVG，以及每一塊積木對到程式碼的哪幾行。 */
export interface BlockMap {
  /**
   * 產生時用的那段程式碼的雜湊（sha256 前 16 碼）。
   *
   * 🔴 **它是「會過期就變紅」的載體**：護欄拿它跟 `lesson.md` 現在的
   * 〈完成的樣子〉比，不一樣就紅。少了它，這張圖會安靜地變成一張
   * **與課文不符的舊圖**——而那正是手工截圖的病。
   */
  readonly codeHash: string
  /** 產生這張圖的那一段程式碼——⚠️ 頁面左半用它，**不再去課文抽一次**。 */
  readonly code: string
  readonly blocks: readonly { readonly id: string; readonly startLine: number; readonly endLine: number }[]
  /** 哪幾行的號碼有印在積木上——課文頁靠它決定哪幾行標成「可以配對的」。 */
  readonly badgeLines: readonly number[]
  readonly svg: string
}

/**
 * 一次 `git log` 問出每一份課文的最後提交時間。
 *
 * ⚠️ **一次呼叫，不是 66 次**：`--name-only` 讓每個 commit 後面接它動到的檔，
 * 由新到舊走一遍，第一次看到就是最後一次改動。
 *
 * 🔴 拿不到（沒有 git、淺 clone、從 tarball 建）就回空的——**呼叫端要能接受沒有**。
 */
export function lastmodFromGit(root: string): Map<string, Date> {
  const out = new Map<string, Date>()
  // 🔴 **淺複製一律不給日期**（2026-09-03，線上抓到）。
  //
  //    淺複製裡 HEAD 沒有父節點，git 把它當【根 commit】——於是
  //    `--name-only` 會把整棵樹都列成「這一次新增的」，每一課的日期
  //    都變成 clone 的那一天。而那**看起來完全正常**：66 筆 lastmod 都在，
  //    只是全部說謊。
  //
  // > **一個「拿不到就不寫」的退路，只有在【拿到假的】也算拿不到時才有用。**
  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'],
      { encoding: 'utf8' }).trim()
    if (shallow === 'true') return out
  } catch { return out }
  let log: string
  try {
    // 🔴 **`core.quotepath=false` 不是可選的**：git 預設會把非 ASCII 的路徑
    //    跳脫成 `"lessons/cpp-beginner/01-\345\215\260…"`，而這 66 個資料夾**全是中文**
    //    ——不關掉的話比對不到，`lastmod` 會安靜地只剩下零星幾筆（實測：66 → 2）。
    log = execFileSync('git',
      ['-c', 'core.quotepath=false', 'log', '--pretty=format:%cI', '--name-only', '--', root],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  } catch { return out }
  let when: Date | null = null
  for (const line of log.split('\n')) {
    if (line === '') continue
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) { when = new Date(line); continue }
    if (when !== null && !out.has(line)) out.set(line, when)
  }
  return out
}

/** 讀出每一條軌道，**照宣告的順序**（與 `load-lessons.ts` 的排法逐字相同）。 */
export function readTracks(root: string): Track[] {
  const rows: Track[] = []
  for (const d of readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const f = join(root, d.name, 'track.json')
    if (!existsSync(f)) continue
    rows.push(parseTrack(d.name, JSON.parse(readFileSync(f, 'utf8'))))
  }
  return rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/**
 * 一條軌道底下的課，**照資料夾名排序**（`01-` `02-` 的編號就是順序）。
 *
 * ⚠️ 編號是**課文的一部分**（`lessons/README.md` 的〈編號〉那一節），
 * 所以這裡不另外發明一個順序欄位。
 */
export function readLessonsOf(root: string, track: Track, gitTimes?: Map<string, Date>): LessonPage[] {
  const dir = join(root, track.id)
  const out: LessonPage[] = []
  for (const d of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!d.isDirectory()) continue
    const j = join(dir, d.name, 'lesson.json')
    const m = join(dir, d.name, 'lesson.md')
    if (!existsSync(j)) continue
    const id = `${track.id}/${d.name}`
    // 🔴 **沒有課文就丟錯，不要產一頁空的**——一頁空白的課文與
    //    「這堂課還沒寫」長得一模一樣（靜默降級反模式）。
    //    ⚠️ 而 `audit-lessons` 已經在守「每一課都要有 lesson.md」，這裡是第二道。
    if (!existsSync(m)) throw new Error(`教案 ${id}：沒有 lesson.md，產不出頁`)
    const bm = join(root, '..', 'assets/blockmaps', `${id.replace('/', '__')}.json`)
    out.push({
      lesson: parseLesson(id, JSON.parse(readFileSync(j, 'utf8'))),
      track,
      md: readFileSync(m, 'utf8'),
      // ⚠️ 讀不到就沒有——**不要在這裡丟錯**：一個沒有對照的頁仍然是一頁課文，
      //    而「少了」是護欄的事（它說得出少了哪幾課，這裡只會說第一課）。
      blockmap: existsSync(bm) ? JSON.parse(readFileSync(bm, 'utf8')) : undefined,
      // ⚠️ git 的路徑是**相對於 repo 根**的，而 `m` 是絕對路徑
      lastmod: gitTimes?.get(relative(process.cwd(), m)),
    })
  }
  return out
}
