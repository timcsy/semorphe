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
import { parseLesson, parseTrack, trackOf, type Lesson, type Track } from './lesson'
import type { LessonView } from './semantic-wave'

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

/**
 * **壞掉的起點**——除錯題的來源（`kind: 'debug'`）。
 *
 * ## 🔴 為什麼它與參考解答分開放
 *
 * ```
 * solutions/<題目 id>.<ext>   對的     Parsons 打散的來源 · e2e 真的跑它
 * starters/<題目 id>.<ext>    壞的     除錯題的起點
 * ```
 *
 * ⚠️ **同一個資料夾裝兩種東西**會讓「那些檔案都跑得過」這條護欄
 * 要嘛放寬（於是它守不住正解），要嘛誤報（於是有人去把壞的改成對的）。
 *
 * > **一個資料夾如果同時裝著「該對的」與「該壞的」，
 * > 那麼任何一條對它的檢查都必須先問「這一份是哪一種」——
 * > 而那個問題的答案不在檔案裡。**
 *
 * 🔴 而除錯題**要的正是那份壞掉的程式跑不過**：
 * 研究說 blocks→text 的工具「往往沒有處理從拖拉到**打字與除錯**的概念轉變」，
 * 而這個 repo 的診斷系統早就在了——缺的只是**一段壞掉的程式**。
 */
const STARTER_FILES = import.meta.glob('/lessons/*/*/starters/*', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** `<課程 id>` ＋ `<題目 id>` → 那份壞掉的起點。⚠️ 沒有就是 `undefined`。 */
export function starterFor(lessonId: string, taskId: string): string | undefined {
  const prefix = `/lessons/${lessonId}/starters/${taskId}.`
  for (const [path, code] of Object.entries(STARTER_FILES)) {
    if (path.startsWith(prefix)) return code
  }
  return undefined
}

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

/**
 * **這一課該從哪一邊開始**——拆輪子的曲線，走**階梯**語意。
 *
 * ## 🔴 轉折點是「從這一課開始」，不是「只有這一課」
 *
 * ⚠️ 第一版把它寫成 `pins.view ?? track.view`，而**第一百一十三條護欄
 * 當場紅了**：軌道預設 `blocks`、第 4 課轉 `compare`，於是**第 5 課退回
 * `blocks`**——一個看起來很合理的 fallback，做出來的是一條鋸齒。
 *
 * ```
 * ❌ pins.view ?? track.view      blocks blocks blocks compare blocks blocks …
 * 🟢 階梯（繼承前一課）            blocks blocks blocks compare compare compare …
 * ```
 *
 * > **一條曲線的宣告，寫的是【轉折點】而不是【每一格的值】
 * > ——而「沒宣告就退回預設」會把轉折變成一根刺。**
 *
 * 🟢 **而護欄抓到它，是因為護欄與產品共用這一支**——兩份判斷會讓
 * 護欄驗過一條產品不會走的路。
 *
 * @param lessonId `<軌道>/<編號>-<課名>`
 * @returns 沒有任何宣告時回 `undefined`（＝不建議，版面完全由使用者作主）
 */
export function viewForLesson(lessonId: string): LessonView | undefined {
  const track = trackOf(lessonId)
  // ⚠️ 課程 id 帶編號（`01-…`），所以字典序**就是**課程順序
  const ids = [...allLessons().keys()]
    .filter((id) => trackOf(id) === track)
    .sort((a, b) => a.localeCompare(b))
  let current = allTracks().get(track)?.view
  for (const id of ids) {
    const pinned = allLessons().get(id)?.pins.view
    if (pinned !== undefined) current = pinned
    if (id === lessonId) return current
  }
  return current
}

/**
 * **這一軌之前的軌教過的全部**——沿 `track.json` 的 `after` 遞迴往上。
 *
 * ⚠️ `seen` 不是裝飾：一份寫成環的 `after` 不該讓整個課程載不起來
 * （`allLessons()` 的註解逐字：「一堂課打錯字會讓**所有**課都開不起來」）。
 */
function inheritedComponents(track: string, seen = new Set<string>()): Set<string> {
  const out = new Set<string>()
  if (seen.has(track)) return out
  seen.add(track)
  const after = allTracks().get(track)?.after
  if (after === undefined) return out
  for (const c of inheritedComponents(after, seen)) out.add(c)
  for (const l of lessonsOfTrack(after)) for (const c of l.components) out.add(c)
  return out
}

/**
 * **這一課拿得到哪些元件**——「這一課 ∪ 同一軌之前每一課」。
 *
 * ## 🔴 它從哪來（2026-10-01，使用者看著畫面）
 *
 * > 「我發現你提供的積木並沒有嚴格漸近增加，**有一些前面課程有的積木到後面
 * > 就不見了**，而且我是希望不只跟著做是這樣，練習也要。」
 *
 * 量出來的規模不是零星：**69 課裡有 62 課**掉過前面教過的元件，
 * 六條軌全部中，合計 1092 次「這一課少了前面教過的」。
 *
 * ```
 * cpp-beginner/05-程式從哪開始   掉 9 顆（var_declare、input、arithmetic …）
 * cpp-beginner/19-遞迴           掉 30 顆
 * arduino/14-記住設定            掉 45 顆
 * ```
 *
 * ## 🔴 根因是【兩份判斷】，而 `viewForLesson` 的註解早就寫過這件事
 *
 * ```
 * audit-solution-vocabulary   「這一課 ∪ 之前每一課」   ← 累積
 * src/ui/app.ts               new Set(currentLesson.components)  ← 只有這一課
 * ```
 *
 * 於是一份參考解答可以**過得了護欄而學生做不出來**：第 4 課宣告了
 * `cpp:input`，聯集裡有它，護欄放行；而學生在第 6 課的工具箱裡按不到。
 * （2026-09-29 學生就是這樣撞到〈練習：兩倍與餘數〉少了「輸入」。）
 *
 * ⟹ 所以這一支的**存在理由**是上面那一支的註解逐字寫的那句：
 *
 * > 🟢 **而護欄抓到它，是因為護欄與產品共用這一支**
 * > ——兩份判斷會讓護欄驗過一條產品不會走的路。
 *
 * ## 🟢 而它與 `viewForLesson` 是同一個形狀：宣告轉折，不宣告每一格
 *
 * ```
 * ❌ 每一課自己那一份        這一課用到的 → 讀成「拿得到的」→ 一條鋸齒
 * 🟢 累積（繼承前面每一課）   嚴格不遞減 → 那才是漸進揭露
 * ```
 *
 * ⚠️ **原本那個行為不是漸進揭露，是【滑動視窗】**——它藏的是已經教過的東西，
 * 而漸進揭露藏的是還沒教的。兩者在第 1 課長得一樣，之後完全相反。
 *
 * ## 這一支不做什麼
 *
 * - **不管鷹架與能力過濾**——那兩刀在 `toolboxComponents()` 與 `buildToolboxInner`。
 * - **不管 `target`**——跨軌繼承進來的 `cpp:*` 在 python 軌上由
 *   `filterByTarget` 濾掉，那是另一刀。這裡只回答「教過了沒」。
 *
 * ## 🟢 跨軌走 `track.after`——而那個宣告【早就在了】
 *
 * ⚠️ 我第一版寫「不跨軌」，而那是錯的：`track.json` 的 `after` 已經宣告好了
 * （`cpp-advanced`、`c-bridge`、`python-bridge` 都是 `after: cpp-beginner`），
 * 而 `audit-solution-vocabulary` 的 `inherited()` 一直在走它。
 *
 * > **少了它，進階軌與兩條銜接軌會被要求「重新教一次陣列與迴圈」
 * > ——而它們的第 1 課逐字寫著「你已經會了」。**
 *
 * `after` 遞迴往上走，而**帶環偵測**：一份寫錯的宣告不該讓課程載不起來。
 *
 * @param lessonId `<軌道>/<編號>-<課名>`
 * @returns 累積到這一課（含）的元件身分；課不存在時回空集合
 */
export function componentsForLesson(lessonId: string): Set<string> {
  const track = trackOf(lessonId)
  const out = inheritedComponents(track)
  // ⚠️ 與 `viewForLesson`／`suggestLessonFor` 同一條規矩：課程 id 帶編號，
  //    所以字典序**就是**課程順序。三處都靠它，改了要一起改。
  const ids = [...allLessons().keys()]
    .filter((id) => trackOf(id) === track)
    .sort((a, b) => a.localeCompare(b))
  for (const id of ids) {
    for (const c of allLessons().get(id)?.components ?? []) out.add(c)
    if (id === lessonId) return out
  }
  // 🔴 走到這裡＝那一課不在它自己的軌裡，而那是不可能的。
  //    回空集合而不是回全部——**一個空工具箱看得見，一個多出來的不會。**
  return new Set()
}
