import type { SemanticNode } from './types'
import type { RuntimeType } from '../interpreter/types'

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

const pending: { component: string; executor: LanguageExecutor }[] = []

/** 語言套件載入時呼叫 */
export function declareExecutor(component: string, executor: LanguageExecutor): void {
  pending.push({ component, executor })
}

/** 直譯器建構時取走。回傳的是**快照**，不清空——直譯器可以被建立多次 */
export function allLanguageExecutors(): readonly { component: string; executor: LanguageExecutor }[] {
  return pending
}

/** 測試用：清空（正式流程不呼叫） */
export function resetLanguageExecutors(): void {
  pending.length = 0
}

// ─────────────────────────────────────────────────────────────────────────
// 語言的內建常數
//
// `INT_MAX`、`EOF`、`nullptr` 這些是**語言的**東西，卻原本由核心直接
// `import ... from '../languages/cpp/builtins'`——那是 P9 原文禁止的形狀，
// 而中立性護欄只數概念身分字串，一個字都看不到它。
// 見 specs/055-finish-executor-move
// ─────────────────────────────────────────────────────────────────────────

const builtinValues = new Map<string, { type: RuntimeType; value: number }>()

/** 語言套件載入時推進來 */
export function declareBuiltinConstants(m: Record<string, { type: RuntimeType; value: number }>): void {
  for (const [k, v] of Object.entries(m)) builtinValues.set(k, v)
}

/** 直譯器建構時取走 */
export function allBuiltinConstants(): ReadonlyMap<string, { type: RuntimeType; value: number }> {
  return builtinValues
}

/** 這個名字是語言的內建常數嗎（除錯快照要略過它們） */
export function isBuiltinName(name: string): boolean {
  return builtinValues.has(name)
}

// ─────────────────────────────────────────────────────────────────────────
// 概念的語言中立父概念
//
// 介面層需要知道「這個語言專屬概念，在低層級時該退回哪個通用概念」。那件事
// 概念自己就宣告了（`abstractComponent`），但介面層拿不到概念註冊表，於是原本
// 各自寫死了一份 16 行的對照表。
// 見 specs/056-abstract-concept-integrity
// ─────────────────────────────────────────────────────────────────────────

const abstractOf = new Map<string, string>()

/** 語言套件載入時推進來 */
export function declareAbstract(componentId: string, parent: string): void {
  abstractOf.set(componentId, parent)
}

/**
 * 「這個概念宣告的是哪一種型別的變數」。
 *
 * **一個事實，兩個消費者**——而它們原本各自寫死了同一個概念身分：
 *
 * | 消費者 | 原本怎麼寫的 |
 * |---|---|
 * | 同步控制器的降級 | `node.component === 'cpp_string_declare' ? 'string' : undefined` |
 * | 積木註冊處的下拉選單 | `if (block.type === 'cpp_string_declare')` 掃工作區 |
 *
 * 兩處都**只認得這一個概念**，而且沒有任何東西提醒下一個同類概念也需要它。
 * 換一種語言的話兩處都要改。
 *
 * 現在是概念自己說的（`components.json` 的 `declaresVariableType`）。
 */
const variableType = new Map<string, string>()

export function declareVariableType(componentId: string, type: string): void {
  variableType.set(componentId, type)
}

/** 這個概念宣告的變數是什麼型別（沒宣告就回 undefined） */
export function variableTypeOf(componentId: string): string | undefined {
  return variableType.get(componentId)
}

/** 哪些概念宣告了這個型別的變數——反查，給下拉選單那類消費者用 */
export function componentsDeclaringVariableType(type: string): string[] {
  return [...variableType].filter(([, v]) => v === type).map(([c]) => c)
}

/** 這個概念的語言中立父概念（沒有就回 undefined） */
export function abstractComponentOf(componentId: string): string | undefined {
  return abstractOf.get(componentId)
}
