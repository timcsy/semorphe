/**
 * 把 `lessons/` 底下的每一份宣告載進來。
 *
 * 🔴 用 `import.meta.glob(..., { eager: true })`，與語言套件、lift 樣式同一招
 * ——**手寫一份清單的話，新增一堂課就要記得改兩個地方**，而忘記的那一次
 * 沒有任何東西會出聲（`load-language-packs.ts` 的檔頭講的是同一件事）。
 *
 * ⚠️ **課文（`lesson.md`）不在這裡**。這一刀只讀宣告；
 * 課文的呈現牽到還沒拍板的互動教材形式。
 */
import { parseLesson, parseTrack, type Lesson, type Track } from './lesson'

const FILES = import.meta.glob('/lessons/*/*/lesson.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

/** `/lessons/cpp-beginner/01-印出一句話/lesson.json` → `cpp-beginner/01-印出一句話` */
function idOf(path: string): string {
  return path.replace(/^\/lessons\//, '').replace(/\/lesson\.json$/, '')
}

/**
 * **參考解答**——Parsons 題打散的來源。
 *
 * 🔴 它們本來只有護欄在讀（`e2e/lessons.spec.ts` 真的跑一次，確認那個
 * 期望輸出做得到）。Parsons 題讓它們有了**第二個消費者**，而那是產品這一側。
 *
 * ⚠️ **答案會進到 bundle 裡**——而那是這件事本來的形狀，不是我引入的漏：
 * 期望輸出（`check.stdout`）早就在裡面了，而 Parsons 題**必須**把那些積木
 * 給他才排得起來。
 *
 * ⚠️ 而課文頁**不受影響**：靜態頁的產生器只讀 `lesson.md`（`solutions/` 是
 * 課目錄下的子資料夾，兩個讀者都以 `lesson.json` 為錨）。
 */
const SOLUTION_FILES = import.meta.glob('/lessons/*/*/solutions/*', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** `<課程 id>` ＋ `<題目 id>` → 那份參考解答。⚠️ 沒有就是 `undefined`。 */
export function solutionFor(lessonId: string, taskId: string): string | undefined {
  const prefix = `/lessons/${lessonId}/solutions/${taskId}.`
  for (const [path, code] of Object.entries(SOLUTION_FILES)) {
    if (path.startsWith(prefix)) return code
  }
  return undefined
}

const TRACK_FILES = import.meta.glob('/lessons/*/track.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

let trackCache: Map<string, Track> | null = null

/** 每一條軌道，**照宣告的順序**。 */
export function allTracks(): ReadonlyMap<string, Track> {
  if (trackCache) return trackCache
  const rows: Track[] = []
  for (const [path, mod] of Object.entries(TRACK_FILES)) {
    const id = path.replace(/^\/lessons\//, '').replace(/\/track\.json$/, '')
    try { rows.push(parseTrack(id, mod.default)) } catch (e) {
      console.error(`[lessons] 軌道 ${id} 載不起來：`, e)
    }
  }
  // 🔴 **glob 的鍵順序不保證**，而選單順序是設計出來的——照 `order` 排。
  rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  trackCache = new Map(rows.map((t) => [t.id, t]))
  return trackCache
}

let cache: Map<string, Lesson> | null = null

export function allLessons(): ReadonlyMap<string, Lesson> {
  if (cache) return cache
  const m = new Map<string, Lesson>()
  for (const [path, mod] of Object.entries(FILES)) {
    const id = idOf(path)
    // 🔴 **一份壞掉的宣告要出聲，而不能讓其餘的一起掛掉。**
    //    整個 `allLessons()` 拋錯的話，一堂課打錯字會讓**所有**課都開不起來。
    try {
      m.set(id, parseLesson(id, mod.default))
    } catch (e) {
      console.error(`[lessons] ${id} 載不起來：`, e)
    }
  }
  cache = m
  return m
}

export function lessonById(id: string): Lesson | undefined {
  return allLessons().get(id)
}

/** 一條軌道底下的每一章，**照編號排**（資料夾名以 `NN-` 開頭）。 */
export function lessonsOfTrack(trackId: string): Lesson[] {
  return [...allLessons().values()]
    .filter((l) => l.id.startsWith(`${trackId}/`))
    .sort((a, b) => a.id.localeCompare(b.id))
}
