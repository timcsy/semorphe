/**
 * 「認不出來的時候，用哪一顆積木裝原文」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * `core/projection/block-renderer.ts` 原本直接寫 `'cpp_raw_code'` 與
 * `'cpp_raw_expression'`——**核心知道某個語言的降級積木叫什麼**。
 *
 * > **核心層是所有語言共用的那一份，所以它的違規比視圖層更硬。**
 *
 * ## 分工——與 `comment-syntax` 同一個形狀
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 核心 | **機制**——降級時包一顆積木、運算式位置換另一顆 |
 * | 語言套件 | **名字**——那兩顆積木叫什麼 |
 *
 * ⚠️ **沒有宣告時要誠實**：回 `null`，讓呼叫端知道「這個語言沒有降級積木」
 * ——**不要猜一個名字**（P6：禁止給出一個看起來合理的結構）。
 *
 * 見 `specs/154-core-blocktype-zero/`
 */

export interface DegradationBlocks {
  /** 語句位置的降級積木型別 */
  statement: string
  /** 運算式位置的降級積木型別 */
  expression: string
}

/**
 * 🔴 **依語言存**（spec 168）。
 *
 * ⚠️ 第一版是**一個全域槽**（`let declared`），於是不論目前是哪個語言，
 * 拿到的都是最後一個載入的套件宣告的那組——實測：一段 Python 降級之後
 * 產出 5 顆 `cpp_raw_code`。**降級本身是對的，而那顆積木的身分是別的語言的。**
 *
 * > **一個「全域只有一份」的登記處，等於宣告了「這個系統只有一個語言」。**
 */
const byLanguage = new Map<string, DegradationBlocks>()
/** 目前是哪個語言——組裝點在切目標時設。 */
let active: string | null = null

/** 語言套件載入時呼叫。 */
export function declareDegradationBlocks(language: string, blocks: DegradationBlocks): void {
  byLanguage.set(language, blocks)
}

/** 切語言時呼叫。 */
export function setDegradationLanguage(language: string): void {
  active = language
}

/**
 * 目前語言的降級積木——⚠️ **`null` 代表這個語言沒有宣告過**，
 * 不是「不需要降級」，**更不是「用別的語言的」**。
 */
export function degradationBlocks(): DegradationBlocks | null {
  if (active === null) return null
  return byLanguage.get(active) ?? null
}
