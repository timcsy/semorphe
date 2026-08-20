/**
 * 「有哪些語言，各自提供什麼」的宣告登記處——**第十個**。
 *
 * ## 為什麼需要這個模組
 *
 * `app.ts` 逐個 import 每一個語言的 topic／target／style／分類／解析器。
 * spec 160 加 Python 時**又加了五處**——而**沒有任何東西說話**：
 * `app.ts` 是中立性護欄豁免的組裝點，報表只印一句
 * 「它知道自己裝了什麼是正常的」，**它不印數字**。
 *
 * > `experience.md` 逐字：「一條護欄的每個**例外**，都要能回答
 * > **『它今天豁免了幾筆』**與『理由是什麼』。」
 *
 * ## 分工——與其餘九個登記處同一個形狀
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 核心 | **機制**——「有一些語言，每個提供這六樣東西」 |
 * | 語言套件 | **它們各自是什麼**（那是策展與內容，導不出來） |
 *
 * ⚠️ **組裝點知道自己裝了「一些語言」是正常的，知道它們各自叫什麼不是**
 * ——後者代表加第三個語言要再編輯它一次。
 *
 * 見 `knowledge/concepts/宣告登記處.md`、`specs/161-manifest-language-loading/`
 */
import type { Topic, Target, StylePreset, ToolboxCategoryDef } from './types'

/** 一個語言套件對外提供的東西——**六項齊全，少一項就是那一項回到 `app.ts`**。 */
export interface LanguagePack {
  id: string
  name: string
  /**
   * 🔴 **這個套件的解析器產出的 AST 屬於哪個文法。**
   *
   * ⚠️ **它與 `id` 不是同一件事，而今天就已經不是**：`cpp` 這一個套件
   * 服務四個教學語言（c-beginner／cpp-beginner／cpp-competitive／arduino），
   * 而它們共用**一個**文法。以 `id` 當過濾鍵會讓 `c-beginner` 拿不到 C++ 的 pattern。
   *
   * > **語言是教學上的分類，文法是 `astNodeType` 那個字串的命名空間。**
   */
  grammar: string
  /**
   * 辨識時要**跳過**的 AST 節點型別——由手寫的 lifter 或 lift-pattern 接手。
   *
   * 🔴 **這是文法的性質，所以它住在這裡。** 在 spec 167 之前它是
   * `app.ts` 裡一串硬編的 C++ 節點型別（`call_expression`／`using_declaration`／…），
   * 而**那一串套用在所有語言上**——Python 的 `for_statement` 因此也被跳過了。
   */
  liftSkipNodeTypes?: readonly string[]
  /**
   * 這個文法的**結構性** lift pattern——不屬於任何一顆元件的那些
   * （拆殼 `unwrap`、運算子分派…）。
   *
   * 🔴 spec 167 之前，組裝點**寫死 import** 了 `src/languages/cpp/lift-patterns.json`
   * ——於是換一個語言時，載進來的仍然是 C++ 的那份。
   *
   * > **一個寫死的 import，是一份沒有人宣告過的預設值。**
   */
  liftPatterns?: readonly unknown[]
  /**
   * 選單順序——**明說的，不是檔名排出來的**。
   *
   * 🔴 `import.meta.glob` 的鍵順序不保證，而**選單順序是設計出來的**
   * （`app.ts` 原本的註解逐字：「檔名排序**不是任何人設計的**」）。
   *
   * ⚠️ 第一版試著在載入器裡 `Object.keys(mods).sort()` ——**那一行一個效果都沒有**：
   * eager glob 在**取得鍵之前**就已經 import 完了，排序的是一份副本。
   * 症狀是預設目標變成 Python。
   * > **一段「為了穩定順序」而寫的程式碼，可能一行效果都沒有——而它看起來很合理。**
   */
  order: number
  /** 課程清單 */
  topics: Topic[]
  /** 目標（板子／方言） */
  targets: Target[]
  /** 風格預設 */
  styles: StylePreset[]
  /** 工具箱分類 */
  categories: ToolboxCategoryDef[]
  /**
   * 建一顆這個語言的解析器。
   *
   * ⚠️ **是工廠不是實例**——解析器的 `init()` 要抓 wasm，
   * 而多數使用者永遠不會切到第二個語言。懶建才不會白付那個代價。
   */
  createParser: () => { init(dir?: string): Promise<void>; parse(code: string): Promise<{ rootNode: unknown }> }
}

const PACKS = new Map<string, LanguagePack>()

/** 語言套件在載入時登錄自己。 */
export function declareLanguagePack(pack: LanguagePack): void {
  PACKS.set(pack.id, pack)
}

/** 全部已登錄的語言套件，**照各自宣告的 `order`**（不是登錄順序、更不是檔名順序）。 */
export function allLanguagePacks(): LanguagePack[] {
  return [...PACKS.values()].sort((a, b) => a.order - b.order)
}

/**
 * 預設目標——**問宣告，不看陣列位置**。
 *
 * 🔴 第一版寫 `allLanguagePacks()[0].targets[0]`，而 glob 的順序讓它變成 Python。
 * 🟢 而 `default: true` **早就宣告在 topic 上**（`cpp-beginner.json`）——
 * 用它就不必再發明一個排序規則。
 */
export function defaultTarget(): Target | undefined {
  for (const p of allLanguagePacks()) {
    const t = p.topics.find((x) => (x as { default?: boolean }).default)
    if (t) { const hit = p.targets.find((x) => x.topic === t.id); if (hit) return hit }
  }
  return allLanguagePacks()[0]?.targets[0]
}

/** 這個語言的套件；沒登錄回 `undefined`（**不猜一個預設值**——P6）。 */
export function languagePack(id: string): LanguagePack | undefined {
  return PACKS.get(id)
}
