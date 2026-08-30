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
}

/**
 * 把一份 `lesson.json` 讀成 `Lesson`。
 *
 * 🔴 **形狀不對要丟錯，不要回一個「空的課」。**
 * 一堂沒有 `components` 的課會讓工具箱變成空的，而畫面上那與
 * 「這堂課就是這麼小」長得一模一樣（靜默降級反模式）。
 */
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
  return {
    id,
    title: o.title,
    estimate: typeof o.estimate === 'string' ? o.estimate : undefined,
    pins: {
      target: pins.target as string | undefined,
      scaffold: psc as ScaffoldMode | undefined,
    },
    components: o.components as string[],
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
