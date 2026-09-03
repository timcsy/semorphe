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
import { join } from 'node:path'
import { parseLesson, parseTrack, type Lesson, type Track } from '../../src/core/lesson'

export interface LessonPage {
  readonly lesson: Lesson
  readonly track: Track
  /** `lesson.md` 的原文——⚠️ 課文只有這一份，不在 `lesson.json` 裡 */
  readonly md: string
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
export function readLessonsOf(root: string, track: Track): LessonPage[] {
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
    out.push({
      lesson: parseLesson(id, JSON.parse(readFileSync(j, 'utf8'))),
      track,
      md: readFileSync(m, 'utf8'),
    })
  }
  return out
}
