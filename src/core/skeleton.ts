/**
 * **一份骨架宣告**——哪幾段程式碼組成程式的骨架，以及它們為什麼在那裡。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者問「**鷹架應該也不只一個吧？算不算是一種元件？**」。
 * 量完現況，答案是三層而其中一層是假的：
 *
 * | 這一格 | 誰決定 | 當時 |
 * |---|---|---|
 * | 哪些元件**是**鷹架 | 元件的性狀（`scaffold`／`scaffoldInMain`） | 🟢 真的宣告 |
 * | **露多少** | 課程組態（`hidden`／`ghost`／`editable`） | 🟢 同日接上 |
 * | 骨架**長什麼樣** | `Target.skeleton` | 🔴 **值域只有 `'main'` 與 `'none'`** |
 *
 * 🔴 **`'none'` 不是「Arduino 的鷹架」，它是「沒有鷹架」**
 * ——`cpp-scaffold.ts` 有一行 `if (skeleton === 'none') return {…全空}`，
 * 而那讓「一種骨架」與「沒有骨架」在程式碼裡分不出來。
 *
 * ## 🔴 它不是一顆元件
 *
 * ```
 * 元件    使用者拖得到 · 可以有很多顆 · 位置由他決定
 * 鷹架    使用者拖不到 · 每支程式恰好一份 · 位置固定在最外層
 * ```
 *
 * 而 `#include`／`func_def(main)`／`return` **本來就都是元件**。
 *
 * > **鷹架不是一顆新積木，是「哪幾段組成骨架，以及它們為什麼在那裡」。**
 *
 * ## 這個模組不做什麼
 *
 * - **不管 `imports`**——那一段是**依賴解析器算出來的**（你用了 `cout` 才有
 *   `<iostream>`），不是宣告的。宣告只管固定的那三段。
 * - **不知道任何語言**——`code` 對它只是一個字串。
 */

export interface SkeletonLine {
  /** 產出的那一行程式碼，逐字 */
  readonly code: string
  /**
   * 幽靈模式下顯示的理由（「為什麼這一行在這裡」）。
   *
   * ⚠️ **每一行都要有**——一行沒有理由的鷹架，與一行學生看不懂的雜訊
   * 長得一模一樣，而那正是 `ghost` 這個模式存在的意義。
   */
  readonly reason: string
}

/**
 * 這份骨架的**進入點函式**——樹裡哪幾顆函式定義**就是**骨架。
 *
 * ## 🔴 它從哪來
 *
 * 2026-08-28 使用者：「**我希望 Arduino 系列也有腳手架**」。
 * 量完之後發現：骨架「**長什麼樣**」已經是宣告了（`preamble`／`entryPoint`／
 * `epilogue`），而「**樹裡哪一塊是骨架**」還寫死在三個地方：
 *
 * ```
 * cpp-scaffold-filter.ts  isFunctionDefinition(n) && n.properties.name === 'main'
 * cpp-scaffold-filter.ts  （同一條，第二個函式裡再寫一次）
 * app.ts                  （第三次）
 * ```
 *
 * > **一份宣告如果只說得出「骨架印出來長怎樣」，
 * > 那「畫面上哪一塊是骨架」就會回去寫死在消費者身上。**
 *
 * ⚠️ 而 Arduino 逼出了它：`setup` 與 `loop` 是**兩個**進入點。
 * `'main'` 那個寫死不只是名字錯，是**數量**也錯。
 */
export interface EntryFunction {
  /** 函式的名字（`main`／`setup`／`loop`） */
  readonly name: string
  /**
   * 為什麼這一顆在這裡——與 `SkeletonLine.reason` 同一條規矩。
   *
   * ⚠️ 這是學生在 `ghost` 模式下唯一會讀到的解釋
   * （「開機時跑一次」／「一直重複跑」）。
   */
  readonly reason: string
}

export interface Skeleton {
  readonly id: string
  readonly name: string
  /**
   * 這份骨架屬於哪個語言——**它決定使用者在這個目標上選得到哪幾份**。
   *
   * 🔴 使用者 2026-08-28：「這也會**被你選什麼目標限制有哪些選擇**」。
   * ⚠️ 而它不是「哪個目標」——`main` 與 `none` 都是 C++ 的骨架，
   *    而 Arduino 的目標與 C++ 的目標**是同一個語言**。
   */
  readonly language: string

  /**
   * 選單上跟在名字後面的那句話。
   *
   * 🔴 **由宣告自己說，不要用推的**（2026-08-28 撞到）：
   * 第一版寫「`entryPoint` 是空的 → 顯示『Arduino sketch』」，
   * 而 Python 的空骨架也被說成 Arduino。
   *
   * > **一個從形狀推出來的說明，在第二個形狀相同的東西進來的那天會說錯話。**
   */
  readonly hint?: string
  /** 進入點**之前**（`using namespace std;`） */
  readonly preamble: readonly SkeletonLine[]
  /** 進入點本身（`int main() {`） */
  readonly entryPoint: readonly SkeletonLine[]
  /** 進入點**之後**（`return 0;`／`}`） */
  readonly epilogue: readonly SkeletonLine[]

  /**
   * 樹裡哪幾顆函式定義**就是**這份骨架——見 `EntryFunction`。
   *
   * ⚠️ 它與 `entryPoint` 回答的是**不同的問題**：
   *
   * ```
   * entryPoint      骨架【印出來】長怎樣    → 程式碼視圖、補丁器
   * entryFunctions  樹裡【哪一塊】是骨架    → 積木視圖的淡化與剝除
   * ```
   *
   * Arduino 的 `entryPoint` 是空的（`setup`／`loop` 由學生或範例寫，
   * 不是骨架生出來的），而 `entryFunctions` 有兩顆。
   */
  readonly entryFunctions: readonly EntryFunction[]
}

export function parseSkeleton(raw: unknown): Skeleton {
  if (raw === null || typeof raw !== 'object') throw new Error('骨架宣告不是一個物件')
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '') throw new Error('骨架宣告缺 id')
  if (typeof o.name !== 'string' || o.name === '') throw new Error(`鷹架 ${o.id} 缺 name`)
  if (typeof o.language !== 'string' || o.language === '') {
    throw new Error(`鷹架 ${o.id} 缺 language——少了它就不知道它對哪些目標合法`)
  }
  const lines = (v: unknown, seg: string): SkeletonLine[] => {
    if (!Array.isArray(v)) throw new Error(`鷹架 ${String(o.id)} 的 ${seg} 不是陣列`)
    return v.map((x, i) => {
      const l = x as Record<string, unknown>
      if (typeof l?.code !== 'string') throw new Error(`鷹架 ${String(o.id)} 的 ${seg}[${i}] 缺 code`)
      // 🔴 理由是必填——見 `SkeletonLine.reason` 的註解
      if (typeof l?.reason !== 'string' || l.reason === '') {
        throw new Error(`鷹架 ${String(o.id)} 的 ${seg}[${i}]（${l.code}）缺 reason`)
      }
      return { code: l.code, reason: l.reason }
    })
  }
  // 🔴 進入點函式：**理由必填**，與 `SkeletonLine` 同一條規矩
  //    （見 `EntryFunction.reason`——它是 `ghost` 模式下唯一的解釋）。
  const entryFunctions: EntryFunction[] = (() => {
    const v = o.entryFunctions
    if (v === undefined) return []
    if (!Array.isArray(v)) throw new Error(`鷹架 ${String(o.id)} 的 entryFunctions 不是陣列`)
    return v.map((x, i) => {
      const f = x as Record<string, unknown>
      if (typeof f?.name !== 'string' || f.name === '') {
        throw new Error(`鷹架 ${String(o.id)} 的 entryFunctions[${i}] 缺 name`)
      }
      if (typeof f?.reason !== 'string' || f.reason === '') {
        throw new Error(`鷹架 ${String(o.id)} 的 entryFunctions[${i}]（${f.name}）缺 reason`)
      }
      return { name: f.name, reason: f.reason }
    })
  })()

  return {
    id: o.id, name: o.name, language: o.language, entryFunctions,
    hint: typeof o.hint === 'string' ? o.hint : undefined,
    preamble: lines(o.preamble, 'preamble'),
    entryPoint: lines(o.entryPoint, 'entryPoint'),
    epilogue: lines(o.epilogue, 'epilogue'),
  }
}

const skeletons = new Map<string, Skeleton>()

/** 語言套件在載入時把自己的鷹架推進來。 */
export function registerSkeleton(s: Skeleton): void {
  skeletons.set(s.id, s)
}

export function skeletonById(id: string): Skeleton | undefined {
  return skeletons.get(id)
}

export function allSkeletons(): ReadonlyMap<string, Skeleton> {
  return skeletons
}

/** 這個語言有哪幾份骨架——**使用者在這個目標上選得到的就是這些**。 */
export function skeletonsOfLanguage(language: string): Skeleton[] {
  return [...skeletons.values()].filter((s) => s.language === language)
}

/**
 * 這份骨架**剝得掉嗎**——`hidden`（只留學生自己的邏輯）做不做得到。
 *
 * 🔴 **兩個進入點就剝不掉**：Arduino 的 `setup` 與 `loop` 各有一批語句，
 * 攤平成一串之後**分不回去**——那不是「藏起來」，是**把資訊弄丟**。
 *
 * > **「藏起來」的前提是還原得回來。**
 *
 * ⚠️ 所以 `hidden` 這個選項在 Arduino 上**不該出現在選單裡**
 * （使用者 2026-08-28：「這也會被你選什麼目標限制有哪些選擇」）。
 */
export function canHideScaffold(shell: Skeleton | undefined): boolean {
  return (shell?.entryFunctions.length ?? 0) <= 1
}

/** 這顆函式定義是這份骨架的進入點嗎。 */
export function entryFunctionOf(shell: Skeleton | undefined, name: unknown): EntryFunction | undefined {
  if (typeof name !== 'string') return undefined
  return shell?.entryFunctions.find((f) => f.name === name)
}

/**
 * 樹裡**骨架已經在了**嗎——這與「有沒有一顆叫那個名字的函式」**不是同一個問題**。
 *
 * ## 🔴 為什麼要分開
 *
 * 兩個消費者（`cpp:program` 的產生器、`SyncController.resyncForTopic`）問的是
 * 「這棵樹是不是 L0 的 body-only，需要我把骨架包上去」。
 *
 * 而 **Arduino 的骨架在程式碼裡是空的**（`entryPoint: []`）：
 * `setup`／`loop` 的本體是學生寫的，骨架不生它們。
 * 所以對 Arduino 而言「骨架已經在了」**永遠是 false**——那條包裝路徑
 * （它同時負責吐出自動引入）要一直走。
 *
 * > **「這一塊是骨架」與「骨架已經生出來了」是兩個問題，
 * > 而寫死成 `name === 'main'` 的時候它們碰巧是同一句話。**
 *
 * ⚠️ 2026-08-28 差一點把它們合成一個：那會讓 Arduino 走 legacy 路徑，
 * 而板子的函式庫標頭**安靜地不見**（`board-library-headers-output`）。
 */
export function skeletonPresent(
  shell: Skeleton | undefined,
  hasFunctionNamed: (name: string) => boolean,
): boolean {
  if (!shell || shell.entryPoint.length === 0) return false
  return shell.entryFunctions.some((f) => hasFunctionNamed(f.name))
}
