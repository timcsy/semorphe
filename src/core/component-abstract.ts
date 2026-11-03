/**
 * **元件的語言中立父元件與變數型別**——從 `language-executors.ts` 拆出來（第 242 刀，6c-4 的前置）。
 *
 * 這兩張登記表**不屬於執行**：介面（`ui/block-registrar.ts`）與同步控制器（`core/sync/sync-controller.ts`）在用。
 * 它們原本與「直譯器的執行器登記處」住在同一個檔，而 6c-4 要刪掉直譯器——名字像執行的檔裡住著非執行的東西，刪的那天會一起被拉斷。
 */

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
