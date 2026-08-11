/**
 * **節點性狀** —— 一顆元件對「共用演算法」宣告的兩件事
 *
 * ## 為什麼需要它
 *
 * 兩個共用檔各有一張以身分為鍵的表，而它們**都不是實作散落**：
 *
 * ```ts
 * // generators/expressions.ts —— 加不加括號，要知道優先級
 * const PRECEDENCE_MAP = new Map([['cpp:cast', 14], ['cpp:array_at', 16], …])
 *
 * // lifters/statements.ts —— for(...) 的三個位置放得下什麼
 * const FOR_LOOP_CONCEPTS = new Set(['cpp:cast', 'cpp:comma_expr', …])
 * ```
 *
 * 括號怎麼加是**排版演算法**，for 迴圈的文法是 **C++ 語法的知識**——
 * 兩者都該留在共用檔。而「我的優先級是 14」「我放得進 for 的第一格」
 * 是**那一顆元件的性質**。
 *
 * > **共用的是演算法，不是那張表。**
 *
 * 這與 [`memberRoleOf`](../../../core/component/registry.ts) 同一個處置：
 * **消費者問性狀，不問身分。**
 *
 * ## ⚠️ 沒有登錄呼叫
 *
 * 膠囊的宣告走 `import.meta.glob` 的 eager 讀取，過渡表是**靜態 import 的 JSON**。
 * 兩者都在模組載入時就位。
 *
 * > **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
 * > （2026-08-10 記下，2026-08-11 又犯了一次——所以這裡不再犯第三次。）
 *
 * ## 過渡表只減不增
 *
 * `pending-node-traits.json` 裡的每一筆都是**還沒膠囊化**的元件。
 * 一顆搬進膠囊時，它的性狀跟著搬進 `component.json`，這裡刪掉一列。
 */
import { registeredComponents } from '../../../core/component/registry'
import 過渡 from '../pending-node-traits.json'

export interface NodeTraits {
  /** 運算子優先級（越大越緊）。沒有＝不需要括號（字面值、變數參照…）。 */
  precedence?: number
  /** 放得進 `for(…;…;…)` 的三個位置嗎。 */
  forLoopPart?: boolean
  /**
   * 在 `switch` 裡是**兜底的那一支**嗎（`default:`）。
   *
   * ⚠️ `cpp:switch` 的執行器原本寫 `caseNode.conceptId === 'cpp:default'`
   * ——**那是真的耦合**（switch 要知道哪一支不比對值），而它擋住 `default`
   * 搬進膠囊。與 `memberRoleOf` 同一個處置：**消費者問性狀，不問身分。**
   */
  defaultCase?: boolean
  /**
   * 這顆元件的宣告要在型別後面接什麼（`int` → `int*`）。
   *
   * ⚠️ `strategies.ts` 原本寫 `if (lifted.conceptId === 'cpp:pointer_declare')
   * liftedType += '*'`——**消費者依身分分派**，而它擋住那顆搬進膠囊。
   */
  typeSuffix?: string
  /**
   * 這顆節點**就是一個具名變數的參照**（`properties.name` 是那個變數名）。
   *
   * ⚠️ `cpp:var_declare_ref` 的執行器要知道「初值是不是一個變數」才決定
   * 做別名還是一般宣告，而它原本寫 `目標.conceptId === 'cpp:var_ref'`
   * ——**一顆膠囊裡提到另一顆的身分**，就近性護欄的反向檢查會指名。
   */
  variableRef?: boolean
  /**
   * 這顆是**鷹架**——L0 的積木視圖裡不該出現它。
   *
   * ⚠️ `cpp-scaffold-filter.ts` 原本逐條寫身分：
   * `node.conceptId === 'cpp:include' || … === 'cpp:include_local'` …
   * **一條 if 一顆元件**，而它擋住那幾顆搬進膠囊。
   *
   * ⚠️ 這不含 `func_def(main)` 與它的 `return`：那兩個不是「這顆是鷹架」，
   * 是「**這顆在 main 裡的時候**是鷹架」——條件在上下文，不在元件。
   * 硬塞成同一個旗標會讓 `return` 在任何地方都消失。
   */
  scaffold?: boolean
  /**
   * 這顆是 `#include` 指示詞（`properties.header` 是標頭名）。
   *
   * ⚠️ 與 `scaffold` **不是同一件事**：`using_namespace` 也是鷹架，
   * 但它**沒有標頭可以去重**。`cpp:program` 的產生器有三處要「這是不是 include」，
   * 而它們原本都寫 `n.conceptId === 'cpp:include' || n.conceptId === 'cpp:include_local'`。
   */
  includeDirective?: boolean
  /**
   * 這顆產生的是**前綴符號**，而那個符號與同類的相接會變成另一個運算子。
   *
   * ```
   * -(-x)  不能寫成 --x   （前置遞減）
   * &(&x)  不能寫成 &&x   （邏輯與）
   * *(*p)  不能寫成 **p
   * ```
   *
   * ⚠️ `cpp:negate` 的產生器原本寫
   * `childNode.conceptId === 'cpp:negate' || … 'cpp:pointer_deref' || … 'cpp:address_of'`
   * ——**一顆膠囊裡列另外兩顆的身分**，就近性護欄的反向檢查會指名。
   *
   * `!` 與 `~` **不在此列**：`!!x`、`~~x` 都是合法且意思正確的。
   */
  prefixOperator?: boolean
}

const 過渡表 = 過渡.traits as Record<string, NodeTraits>

function 性狀(conceptId: string): NodeTraits | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  const 宣告 = (c?.manifest as { traits?: NodeTraits } | undefined)?.traits
  return 宣告 ?? 過渡表[conceptId]
}

/**
 * 這顆元件的固定優先級。
 *
 * ⚠️ 回 `undefined` 的意思是「**不需要括號**」，不是「不知道」——
 * 呼叫端把它當 100（比誰都緊）。運算子相依的優先級（`cpp:logic` 看 `||` 還是 `&&`）
 * 不在這裡：那是**同一顆元件的不同實例有不同答案**，不是一個宣告得出來的常數。
 */
export function precedenceOf(conceptId: string): number | undefined {
  return 性狀(conceptId)?.precedence
}

/** 這顆元件放得進 for 迴圈的三個位置嗎。沒宣告＝不行（保守）。 */
export function canBeForLoopPart(conceptId: string): boolean {
  return 性狀(conceptId)?.forLoopPart === true
}

/** 這顆元件是 `switch` 裡兜底的那一支嗎。沒宣告＝不是（保守）。 */
export function isDefaultCase(conceptId: string): boolean {
  return 性狀(conceptId)?.defaultCase === true
}

/** 這顆元件的宣告在型別後面接什麼。沒宣告＝什麼都不接。 */
export function typeSuffixOf(conceptId: string): string {
  return 性狀(conceptId)?.typeSuffix ?? ''
}

/** 這顆節點就是一個具名變數的參照嗎。沒宣告＝不是（保守）。 */
export function isVariableRef(conceptId: string): boolean {
  return 性狀(conceptId)?.variableRef === true
}

/** 這顆是鷹架嗎（L0 的積木視圖不顯示）。沒宣告＝不是（保守）。 */
export function isScaffold(conceptId: string): boolean {
  return 性狀(conceptId)?.scaffold === true
}

/** 這顆是 `#include` 指示詞嗎。沒宣告＝不是（保守）。 */
export function isIncludeDirective(conceptId: string): boolean {
  return 性狀(conceptId)?.includeDirective === true
}

/** 這顆產生的前綴符號會與同類相接成另一個運算子嗎。沒宣告＝不會。 */
export function isPrefixOperator(conceptId: string): boolean {
  return 性狀(conceptId)?.prefixOperator === true
}
