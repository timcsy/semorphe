/**
 * **一堂課是一份宣告，而編輯器讀它。**
 *
 * ## 它從哪來
 *
 * `principles.md:97`（P4 漸進揭露的修訂條①）逐字：
 *
 * > 「**一個過濾機制若沒有附帶「條件從哪來」，它把認知負荷搬家而不是減少。**
 * >  而那個來源今天缺的是**教材**」
 *
 * 使用者 2026-08-12 的原話是那條修訂的來源：
 *
 * > 「我會乾脆叫學生把全部都打勾，**那有沒有這個漸進揭露是沒用的**」
 *
 * 2026-08-28 那個來源存在了（`lessons/` 六軌 65 堂），
 * 而在此之前**產品一個字都讀不到它們**（`grep -rn lessons src/` 零筆）。
 * 這個模組是那條線的第一段。
 *
 * ## 🔴 釘住的控制項要【消失】，不是變灰
 *
 * ```
 * 變灰   「這裡有一個你不能碰的東西」→ 仍然是負擔，而且更糟（它在嘲笑你）
 * 消失   這一堂課裡，那不是一個問題
 * ```
 *
 * ⚠️ 而 `draft/教案是一個宣告` 說「這個機制已經存在」——**那是錯的**（2026-08-28 實測）。
 * `ControlSurface` 的六個值**全部是「畫在哪」，沒有一個是「不畫」**，
 * 而 `featureReasons` 管的是 `features` 開關不是控制項。
 * 「消失」是這一刀真正的新機制。
 *
 * ## 這個模組不做什麼
 *
 * - **不碰 DOM、不碰 `location`**——`lessonIdFromQuery` 吃的是查詢字串本身，
 *   由宿主那側餵進來（四項獨立性）。
 * - **不呈現課文**（`lesson.md`）——那是另一刀，而它牽到還沒拍板的互動教材形式。
 * - **不知道任何語言**——`components` 對它只是一串身分。
 */
import { interactionById } from './interactions'
import type { ControlId } from './host/controls'

/**
 * 一條**軌道**——`lessons/<軌道>/track.json`。
 *
 * 🔴 為什麼需要它：使用者 2026-08-28
 * 「**我覺得課程可以再拆分成課程和章節，目標可以更單純一些**」。
 *
 * 在此之前「課程」只有一層（65 堂平鋪），而目標選單裡混著
 * `C++ 進階`——**它其實是一條軌道，不是一個語言**。拆成三層之後：
 *
 * ```
 * 目標   語言／板子    C++ · C · Python · Arduino Uno · ESP32…
 * 課程   軌道          C++ 入門 · C++ 進階 · Python 入門 · Arduino 專題…
 * 章節   課            01 印出一句話 · 02 記住資料…
 * ```
 */
/**
 * 鷹架（`#include`／`int main()`／`setup`＋`loop`）在積木上露多少。
 *
 * 🔴 **它的來源是課程，不是層級樹**（2026-08-28 使用者：
 * 「這是不是要搭配課程來決定鷹架？也就是說在課程的組態就可以設定」）。
 *
 * 在此之前它是 `enabledBranches` 的函數——而那個集合同時扛著
 * 「哪些元件看得到」，於是**改其中一個永遠會偷偷改到另一個**。
 *
 * ⚠️ 而「鷹架**長什麼樣**」是另一格，它住在**目標**上（`skeleton`）：
 * Arduino 是 `setup`＋`loop`，C++ 是 `int main()`。兩件事不要混。
 *
 * ```
 * hidden     剝掉——學生只看自己的邏輯（Scratch 那一路）
 * ghost      看得到、動不了
 * editable   完整的程式，學生改得動
 * ```
 */
export type ScaffoldMode = 'hidden' | 'ghost' | 'editable'

/** 詞彙 → `program-scaffold.ts` 的深度。⚠️ 那份對應住在這裡一份，不要各自寫。 */
export function scaffoldDepthOf(mode: ScaffoldMode): number {
  return mode === 'hidden' ? 0 : mode === 'ghost' ? 1 : 2
}

/**
 * 深度 → 詞彙——上面那支的**反向**。
 *
 * ⚠️ 它與 `scaffoldDepthOf` 必須住在一起：兩份對應各寫一次的話，
 * 其中一份會在加第四個模式的那天被漏掉。
 */
export function scaffoldModeOfDepth(depth: number): ScaffoldMode {
  return depth === 0 ? 'hidden' : depth === 1 ? 'ghost' : 'editable'
}

export interface Track {
  /** 資料夾名，例如 `cpp-beginner` */
  readonly id: string
  readonly name: string
  /** 這條軌道跑在哪個目標上——選了它就切過去 */
  readonly target: string
  /** 選單裡的順序，小的在前 */
  readonly order: number
  readonly description?: string
  /**
   * 這條軌道要露多少鷹架。省略 ＝ `editable`。
   *
   * 🔴 預設是**露出來**，因為這 65 堂課**從第一課就在教它**
   * （C++ 第 1 課講 `main` 是起跑線，Arduino 第 1 課講 `setup`／`loop`）。
   * ⚠️ `hidden` 是給另一種教法用的（先寫邏輯，之後才揭露程式的骨架）。
   */
  readonly scaffold: ScaffoldMode
  /**
   * 用哪一份**骨架宣告**（`core/skeleton.ts` 的 id）——省略 ＝ 跟著目標走。
   *
   * 🔴 兩件事不要混（2026-08-28 使用者：「鷹架應該也不只一個吧？」）：
   *
   * ```
   * scaffold   露【多少】   hidden / ghost / editable
   * skeleton      長【什麼樣】 哪幾段組成骨架（main / none / …）
   * ```
   *
   * ⚠️ 覆寫它的用處是「同一個目標、不同的骨架」——例如競賽軌想要
   * `ios::sync_with_stdio(false)` 那份前言，而語言仍然是 C++。
   * 今天沒有軌道用到它，而**機制在**：多一份 `skeletons/*.json` 就通。
   */
  readonly skeleton?: string
}

export function parseTrack(id: string, raw: unknown): Track {
  if (raw === null || typeof raw !== 'object') throw new Error(`軌道 ${id}：不是一個物件`)
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string' || o.name === '') throw new Error(`軌道 ${id}：缺 name`)
  if (typeof o.target !== 'string' || o.target === '') throw new Error(`軌道 ${id}：缺 target`)
  if (o.skeleton !== undefined && typeof o.skeleton !== 'string') {
    throw new Error(`軌道 ${id}：skeleton 不是字串`)
  }
  const sc = o.scaffold
  if (sc !== undefined && !['hidden', 'ghost', 'editable'].includes(String(sc))) {
    throw new Error(`軌道 ${id}：scaffold 不是 hidden／ghost／editable`)
  }
  return {
    id, name: o.name, target: o.target,
    order: typeof o.order === 'number' ? o.order : 1e9,
    description: typeof o.description === 'string' ? o.description : undefined,
    scaffold: (sc as ScaffoldMode) ?? 'editable',
    skeleton: o.skeleton as string | undefined,
  }
}

/** `cpp-beginner/01-印出一句話` → `cpp-beginner` */
export function trackOf(lessonId: string): string {
  return lessonId.split('/')[0] ?? lessonId
}

export interface LessonPins {
  /** 釘住哪一個目標（`cpp`／`arduino-uno`／`python`…） */
  readonly target?: string
  /**
   * 這一堂要露多少鷹架——**覆寫軌道的設定**。
   *
   * ⚠️ 多數課不需要它（跟著軌道走就好）。它存在是為了那種
   * 「同一軌裡有一課要先把骨架藏起來」的情況。
   */
  readonly scaffold?: ScaffoldMode
}

export interface Lesson {
  /** `<軌道>/<編號>-<課名>`，例如 `cpp-beginner/01-印出一句話` */
  readonly id: string
  readonly title: string
  readonly estimate?: string
  readonly pins: LessonPins
  /** 這堂課要開的元件身分——🔴 **量出來的，不是列出來的**（見 `write-lesson` skill） */
  readonly components: readonly string[]
  /**
   * 這一課會用到哪些**操作**（`core/interactions.ts` 的 id）。
   *
   * 🔴 課程只說「我會用到什麼」，**不說它長什麼樣**——長相住在登錄表，
   * 而那個片段是腳本錄的。少了這一層，操作說明會散在 66 份課文裡各自腐爛。
   *
   * ⚠️ 省略 ＝ 這一課不需要教操作（多數課都是這樣）。
   */
  readonly interactions?: readonly string[]
  /**
   * **這一課做對了長什麼樣**——輸出，以及要餵給它的輸入。
   *
   * ## 🔴 它 2026-08 就寫在每一份 `lesson.json` 裡了，而【型別裡一直沒有它】
   *
   * ```
   * 每一份 lesson.json   66 課每一課都有 check.stdout
   * 這個介面             🔴 沒有 check → parseLesson 直接把它丟掉
   * 唯二的讀者           e2e/lessons.spec.ts · audit-lessons（都讀原始 JSON）
   * ```
   *
   * ⚠️ 上面那三行本來寫成 `lessons/⟨星號⟩/lesson.json`，而那個 `⟨星號⟩/`
   * **把這段註解提前關掉了**——`tsc` 當場紅。路徑裡有萬用字元時要繞開它。
   *
   * 也就是說**應用根本不知道它存在**——學生按了執行，沒有任何人告訴他對了沒有。
   *
   * > **一個「東西早就在了、缺的只是出口」的形狀，這個專案今天是第二次遇到**
   * > （第一次是 13 萬字的課文，見 `history/205`）。
   *
   * ⚠️ **只判輸出，不判寫法**：學生用 `while` 而不是 `for` 不是錯——
   * 拿結構去判對錯就變成「猜老師心裡的答案」，那是自動評分最經典的失敗。
   *
   * ## 🪦 而「一課一個 `check`」這個形狀活了兩天就被推翻了
   *
   * 使用者 2026-09-04：「課程應該除了課程題目之外，還會有一些練習題，
   * **這樣去比對結果不就沒有辦法做練習題了**？」
   *
   * ```
   * 學生：認真在做練習 2
   * 裁判：還沒對——你的輸出是「1 2 3」，這一課要的是「Hello!」
   * ```
   *
   * 🔴 **一個會在學生做對事情時說他錯的裁判，比沒有裁判更糟**
   * ——它教會學生「這個勾沒有意義」，而那正是 `parseCheck` 檔頭在防的事。
   *
   * 於是 `check` 升格成 `tasks`：**一課有好幾題，每一題各自有裁判**。
   * 舊的 `check` 仍然讀得進來（成為第一題「跟著做」），66 課一個字都不用改。
   */
  readonly tasks: readonly LessonTask[]
}

/**
 * 一堂課裡的**一題**——課程題目、練習題，都是題。
 *
 * ## 🔴 沒有 `check` 的題目仍然是題目
 *
 * 「把上面的程式改用 `while` 寫」的輸出與原本**一模一樣**，而這裡立過的規矩是
 * 「只判輸出，不判寫法」——所以它就是**一題沒有裁判的題目**。
 *
 * > **不是每一題都有裁判，而沒有裁判不等於沒有題目。**
 *
 * ⚠️ 那種題目該做的事是**沉默**，不是說「對了」——後者是靜默降級的一種：
 * 一個永遠說對的勾會讓所有的勾都貶值。
 */
export interface LessonTask {
  /** 這一課裡唯一。⚠️ 它會被存進通過紀錄，所以**改了它等於把紀錄清掉**。 */
  readonly id: string
  /** 選單上那一行，例如「跟著做」「練習 1：印 1 到 5」。 */
  readonly title: string
  /** 這一題的裁判。⚠️ 省略 ＝ 這一題判不了（見上）。 */
  readonly check?: LessonCheck
}

/**
 * 舊的一課一個 `check`，讀成第一題。
 *
 * 🔴 標題是「跟著做」而不是課名——它就是課文帶著學生做的那一支，
 * 而 PRIMM 裡那一步的名字正是這個。
 */
const FOLLOW_ALONG: { readonly id: string; readonly title: string } =
  { id: 'follow', title: '跟著做' }

/**
 * 選單裡「不對應任何題目」那一項的值。
 *
 * 🔴 它是**看得見的狀態**，不是「沒有選」——使用者 2026-09-04 提的
 * 「還是先不選擇題目純練習」。裁判在這個狀態下**完全沉默**。
 */
export const FREE_PRACTICE = ''

/** 這一課的裁判。⚠️ 沒有 `check` 的課就是**沒有裁判**，不是「永遠算對」。 */
export interface LessonCheck {
  /** 期望的標準輸出——**逐字比對**（見 `compareOutput` 對空白的處置）。 */
  readonly stdout: string
  /** 要餵給它的輸入行。⚠️ 空陣列是「這一課不需要輸入」，不是「還沒寫」。 */
  readonly stdin: readonly string[]
}

/**
 * 把一份 `lesson.json` 讀成 `Lesson`。
 *
 * 🔴 **形狀不對要丟錯，不要回一個「空的課」。**
 * 一堂沒有 `components` 的課會讓工具箱變成空的，而畫面上那與
 * 「這堂課就是這麼小」長得一模一樣（靜默降級反模式）。
 */
/**
 * 讀 `check`——⚠️ **形狀不對要丟錯，不要回一個「空的裁判」**。
 *
 * 一個 `stdout: undefined` 的裁判會**永遠說對**，而那比沒有裁判更糟：
 * 學生會學到「這個勾沒有意義」。
 */
function parseCheck(id: string, raw: unknown): LessonCheck | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object') throw new Error(`教案 ${id}：check 不是一個物件`)
  const c = raw as Record<string, unknown>
  if (typeof c.stdout !== 'string') throw new Error(`教案 ${id}：check.stdout 不是字串`)
  const stdin = c.stdin ?? []
  if (!Array.isArray(stdin) || stdin.some((x) => typeof x !== 'string')) {
    throw new Error(`教案 ${id}：check.stdin 不是字串陣列`)
  }
  return { stdout: c.stdout, stdin: stdin as string[] }
}

/**
 * 讀 `tasks`——沒有的話，把舊的 `check` 讀成唯一那一題。
 *
 * ⚠️ **id 重複要當場丟錯**：兩題同 id 的話，通過紀錄會把它們當成同一題，
 * 而畫面上看不出來——學生做完第一題，第二題自己就打勾了。
 */
function parseTasks(id: string, raw: unknown, legacy: LessonCheck | undefined): LessonTask[] {
  if (raw === undefined || raw === null) {
    return legacy ? [{ ...FOLLOW_ALONG, check: legacy }] : []
  }
  if (!Array.isArray(raw)) throw new Error(`教案 ${id}：tasks 不是陣列`)
  const seen = new Set<string>()
  return raw.map((x, i) => {
    if (x === null || typeof x !== 'object') throw new Error(`教案 ${id}：tasks[${i}] 不是一個物件`)
    const t = x as Record<string, unknown>
    if (typeof t.id !== 'string') throw new Error(`教案 ${id}：tasks[${i}] 缺 id`)
    // ⚠️ 空字串**不是**「缺 id」，它是【純練習那一格的值】——訊息要說出這件事，
    //    不然作者只會把它改成 `id: ' '`。
    if (t.id === FREE_PRACTICE) throw new Error(`教案 ${id}：tasks[${i}] 的 id 不得是空字串——那是「純練習」`)
    if (seen.has(t.id)) throw new Error(`教案 ${id}：tasks 有重複的 id「${t.id}」`)
    seen.add(t.id)
    if (typeof t.title !== 'string' || t.title === '') throw new Error(`教案 ${id}：tasks[${i}] 缺 title`)
    return { id: t.id, title: t.title, check: parseCheck(`${id}#${t.id}`, t.check) }
  })
}

/** 這一課的第幾題。⚠️ `FREE_PRACTICE`（純練習）回 `undefined`，那不是缺陷。 */
export function taskById(lesson: Lesson | undefined, taskId: string | undefined): LessonTask | undefined {
  if (!lesson || taskId === undefined || taskId === FREE_PRACTICE) return undefined
  return lesson.tasks.find((t) => t.id === taskId)
}

/** 逐行比對的結果——⚠️ `kind` 是**這一行怎麼了**，不是「對或錯」。 */
export interface OutputDiffLine {
  readonly kind: 'same' | 'different' | 'missing' | 'extra'
  /** 學生的那一行（`missing` 時是 `undefined`）。 */
  readonly got?: string
  /** 這一課要的那一行（`extra` 時是 `undefined`）。 */
  readonly want?: string
}

export interface OutputComparison {
  readonly passed: boolean
  readonly lines: readonly OutputDiffLine[]
}

/**
 * 把學生的輸出與這一課要的輸出**逐行**比對。
 *
 * ## 🔴 為什麼是逐行，不是整串比
 *
 * 整串比只答得出「對」或「錯」，而**「錯」不是可以行動的資訊**。
 * 逐行才說得出「你少了第 3 行」「你的第 2 行多了一個空格」——
 * 那才是 Hattie 說的「針對任務與過程」的回饋。
 *
 * > **回饋要說的是「你的迴圈少跑了一次」，不是「你答錯了」。**
 *
 * ## ⚠️ 空白的處置：行尾寬容，行首不寬容
 *
 * ```
 * 行尾空白   忽略  —— `cout << i << " "` 是很常見的寫法，而它會留下行尾空格
 * 行首空白   在意  —— 縮排是輸出格式的一部分（例如印三角形）
 * 最後的換行 忽略  —— `endl` 與否不該決定對錯
 * ```
 */
export function compareOutput(got: string, want: string): OutputComparison {
  const split = (s: string): string[] => s.replace(/\n+$/, '').split('\n').map((l) => l.replace(/[ \t]+$/, ''))
  const a = split(got)
  const b = split(want)
  const lines: OutputDiffLine[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) lines.push({ kind: 'missing', want: b[i] })
    else if (i >= b.length) lines.push({ kind: 'extra', got: a[i] })
    else if (a[i] === b[i]) lines.push({ kind: 'same', got: a[i], want: b[i] })
    else lines.push({ kind: 'different', got: a[i], want: b[i] })
  }
  return { passed: lines.every((l) => l.kind === 'same'), lines }
}

export function parseLesson(id: string, raw: unknown): Lesson {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`教案 ${id}：不是一個物件`)
  }
  const o = raw as Record<string, unknown>
  if (typeof o.title !== 'string' || o.title === '') {
    throw new Error(`教案 ${id}：缺 title`)
  }
  if (!Array.isArray(o.components) || o.components.length === 0) {
    throw new Error(`教案 ${id}：缺 components——一堂課至少要開一顆積木`)
  }
  for (const c of o.components) {
    if (typeof c !== 'string') throw new Error(`教案 ${id}：components 裡有不是字串的東西`)
  }
  const pins = (o.pins ?? {}) as Record<string, unknown>
  if (pins.target !== undefined && typeof pins.target !== 'string') {
    throw new Error(`教案 ${id}：pins.target 不是字串`)
  }
  const psc = pins.scaffold
  if (psc !== undefined && !['hidden', 'ghost', 'editable'].includes(String(psc))) {
    throw new Error(`教案 ${id}：pins.scaffold 不是 hidden／ghost／editable`)
  }
  // 🔴 **認不得的 id 要當場丟錯**，不要安靜地跳過——一個拼錯的 `interactions`
  //    會讓那一課少一段操作說明，而**畫面上看不出少了什麼**。
  const inter = o.interactions
  if (inter !== undefined) {
    if (!Array.isArray(inter)) throw new Error(`教案 ${id}：interactions 不是陣列`)
    for (const x of inter) {
      if (typeof x !== 'string') throw new Error(`教案 ${id}：interactions 裡有不是字串的東西`)
      if (interactionById(x) === undefined) {
        throw new Error(`教案 ${id}：interactions 有認不得的 id「${x}」` +
          `——登錄表在 core/interactions.ts`)
      }
    }
  }
  return {
    id,
    title: o.title,
    estimate: typeof o.estimate === 'string' ? o.estimate : undefined,
    pins: {
      target: pins.target as string | undefined,
      scaffold: psc as ScaffoldMode | undefined,
    },
    components: o.components as string[],
    interactions: inter as string[] | undefined,
    tasks: parseTasks(id, o.tasks, parseCheck(id, o.check)),
  }
}

/**
 * 這堂課**替使用者決定了**哪些控制項——它們該從畫面上消失。
 *
 * ## 🪦 而今天它回空的——那個假設被使用者用一次就推翻了
 *
 * `draft/教案是一個宣告` 主張「釘住的控制項應該**消失**，不是變灰」，
 * 理由是「`target` 老師有意見 → 該由課程決定」。我照著做了，
 * 而使用者選了一堂課之後說：
 *
 * > 「**我發現選了課程之後目標就不見了**」
 *
 * 兩個具體的毛病：
 *
 * ```
 * 流程斷了   他自己拍板的順序是「先選目標再選課程」，
 *            而目標消失之後那句話只成立一次
 * 看不見了   畫面上剩「樹上走訪」，而它沒說自己是【C++ 進階】那一軌的
 * ```
 *
 * 🟢 **正解是「換目標就退出課程」**（課的清單本來就是跟著目標走的），
 * 而不是把目標藏起來。
 *
 * > **「這個選項已經被替你決定了」與「你看不到它是什麼」是兩件事，
 * > 而藏起來同時做了兩件。**
 *
 * ⚠️ 這個機制**留著**：它是對的形狀，只是今天沒有東西適用。
 * 哪天有一種 pin 真的該讓控制項消失（例如釘住介面語言），這裡接得上。
 */
export function controlsPinnedBy(_lesson: Lesson): readonly ControlId[] {
  const out: ControlId[] = []
  // 🪦 這裡曾經回一個 `'branches'`——**而那顆控制項當天就整個退場了**
  //    （`core/host/controls.ts` 的墓碑）。
  //
  //    ⚠️ 過程值得記：第一版讓它「選了課才消失」，而使用者看著畫面問
  //    「層級那邊還是沒變？」——**沒選課的時候它還在，而它開機就全開**，
  //    也就是一個**只能讓事情變糟**的控制項。
  //
  //    > **一個「有課才藏起來」的東西，等於承認它沒有課的時候也不該在。**
  return out
}

/**
 * 從查詢字串取出課程 id。`?lesson=cpp-beginner/01-印出一句話`
 *
 * ⚠️ 吃**字串**不吃 `location`——這個模組不碰瀏覽器。
 */
export function lessonIdFromQuery(search: string): string | null {
  const q = new URLSearchParams(search)
  const v = q.get('lesson')
  return v !== null && v.trim() !== '' ? v.trim() : null
}

/**
 * 課文靜態頁的網址。`cpp-beginner/11-for迴圈` → `/lessons/cpp-beginner/11-for%E8%BF%B4%E5%9C%88/`
 *
 * 🔴 **它與上面那支是一對**：一個把網址讀成 id，一個把 id 寫成網址。
 * 兩邊分開住的話，中文課名的 encode 遲早會不一樣——而症狀是一個 404。
 *
 * ⚠️ 斜線**不 encode**（它是路徑分隔），課名**要 encode**（它有中文）。
 * 這一條由 `audit-lesson-pages` 的最後一支釘著。
 */
export function lessonDocHref(id: string): string {
  return `/lessons/${id.split('/').map(encodeURIComponent).join('/')}/`
}
