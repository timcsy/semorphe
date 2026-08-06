import type { SemanticNode } from './types'

/**
 * 語言套件推進來的執行器登記處。
 *
 * ## 為什麼需要它
 *
 * 執行那一路原本住在核心層——核心因此認識了一堆 C++ 專屬的概念身分。搬回
 * 語言套件之後，核心不能再直接 import 它們（那就是 P9 要禁的事），所以需要
 * 一個中介：**語言套件載入時推進來，直譯器建構時取走。**
 *
 * 與 `skip-declarations` 是同一個形狀，也與既有的 `registerLanguage` /
 * `setDependencyResolver` 同一個形狀。核心**不知道**有哪些語言，只知道有人
 * 推東西進來。
 *
 * ## 為什麼是「推＋取」而不是直譯器直接查
 *
 * 執行器是函式，數量大且呼叫頻繁。放進直譯器自己的註冊表，執行時就是一次
 * Map 查詢，與搬移前完全相同——**搬移不得改變執行行為，包括效能特性**。
 *
 * 見 specs/054-execute-into-capsules/data-model.md 契約 3
 */
export type LanguageExecutor = (node: SemanticNode, ctx: never) => unknown

const pending: { concept: string; executor: LanguageExecutor }[] = []

/** 語言套件載入時呼叫 */
export function declareExecutor(concept: string, executor: LanguageExecutor): void {
  pending.push({ concept, executor })
}

/** 直譯器建構時取走。回傳的是**快照**，不清空——直譯器可以被建立多次 */
export function allLanguageExecutors(): readonly { concept: string; executor: LanguageExecutor }[] {
  return pending
}

/** 測試用：清空（正式流程不呼叫） */
export function resetLanguageExecutors(): void {
  pending.length = 0
}
