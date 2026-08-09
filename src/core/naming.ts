/**
 * 元件命名的**規則機制**——詞彙表由各套件提供
 *
 * ## 為什麼詞彙表不在這裡
 *
 * 第一版把主體詞彙（`string`／`vector`／`istringstream`…）寫在這個檔案裡，
 * 而**第二十二條護欄（語法耦合）當場報了違規**：`src/core/` 不得寫死特定語言的
 * 語法記號。那不是護欄太嚴——一個把 `istringstream` 寫死在核心的檔案，
 * 就是核心認得 C++ 了。
 *
 * 這與 D 項的改名表是同一個處置（`storage-version.ts`：核心給機制、套件給資料），
 * 而**同一個錯我隔一天又犯了一次**——因為那次的形狀是「一張表」，
 * 這次的形狀是「一份詞彙」，看起來不像同一件事。
 *
 * ## 分工
 *
 * - **核心**：分隔符、拆名字的演算法、型別
 * - **套件**：主體／操作／修飾詞／單字名的詞彙表（見 `src/languages/cpp/naming.ts`）
 */

/** 名字內部的分隔符。**只有一種。** */
export const SEPARATOR = '_'

/** 一個域／套件的命名詞彙 */
export interface NamingVocabulary {
  /** 主體——「這個操作作用在什麼上」 */
  subjects: readonly string[]
  /** 操作——**封閉集合**，同一個操作在任何主體上用同一個字 */
  operations: readonly string[]
  /** 修飾詞——**不得站在主體的位置**（該是參數或形態） */
  modifiers: readonly string[]
  /** 允許的單字名——語言構造（`switch`／`lambda`），不含抄來的函式庫名 */
  atomicNames: readonly string[]
}

export interface ParsedName {
  subject?: string
  operation?: string
  /** 不可分解——要嘛是宣告過的單字名，要嘛是違規 */
  atomic: boolean
}

/**
 * 拆名字：**最長的主體前綴勝出**，其餘是操作。
 *
 * 最長優先是必要的——`array` 與 `array_2d` 都是主體，
 * 而 `array_2d_access` 的主體是後者。
 */
export function parseName(bare: string, subjects: readonly string[]): ParsedName {
  const sorted = [...subjects].sort((a, b) => b.length - a.length)
  for (const s of sorted) {
    if (bare === s) return { subject: s, atomic: false }
    if (bare.startsWith(s + SEPARATOR)) {
      return { subject: s, operation: bare.slice(s.length + 1), atomic: false }
    }
  }
  return { atomic: true }
}
