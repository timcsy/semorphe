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

let declared: DegradationBlocks | null = null

/** 語言套件載入時呼叫。 */
export function declareDegradationBlocks(blocks: DegradationBlocks): void {
  declared = blocks
}

/**
 * 目前的降級積木——⚠️ **`null` 代表沒有語言套件宣告過**，
 * 不是「這個語言不需要降級」。
 */
export function degradationBlocks(): DegradationBlocks | null {
  return declared
}
