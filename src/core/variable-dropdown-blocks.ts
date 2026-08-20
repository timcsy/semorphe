/**
 * 「這個積木有一個列出工作區變數的下拉選單」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * 有一類積木**沒辦法用純 JSON 定義**：它的某個欄位是下拉選單，而選項要從
 * **即時的工作區**算出來（「現在有哪些字串變數？」）。那需要 Blockly 的
 * API，所以積木的建構程式碼住在介面層——那是對的，它是介面層的機制。
 *
 * 但**「哪些積木需要這個機制」不是介面層的知識。** 原本介面層直接寫
 * `Blockly.Blocks['cpp_string_at'] = { … }`——一個 C++ 專屬的身分寫死在
 * 呈現層，而換一種語言，取字元的積木叫別的名字。
 *
 * ## 分工
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 介面層 | **機制**——怎麼建一個會掃工作區的下拉選單 |
 * | 語言套件 | **名單**——哪些積木要用它、欄位叫什麼、列哪一種型別的變數 |
 *
 * 變數型別本身也是宣告的（`components.json` 的 `declaresVariableType`），所以
 * 加一個新的字串宣告概念時，這個下拉選單**自動涵蓋它**。
 *
 * 形狀與 `skip-declarations.ts`、`language-executors.ts`、`comment-syntax.ts`
 * 相同：語言套件推、核心讀。
 *
 * 見 specs/064-variable-dropdown-declaration/
 */

export interface VariableDropdownBlock {
  /** 積木型別（也是它的概念身分） */
  blockType: string
  /** 下拉選單所在的欄位名 */
  field: string
  /** 列出哪一種型別的變數——對應 `components.json` 的 `declaresVariableType` */
  variableType: string
  /** 值輸入的名稱（例如索引） */
  valueInput: string
  /** 積木顏色 */
  colour: string
}

const declarations: VariableDropdownBlock[] = []

/** 語言套件載入時呼叫 */
export function declareVariableDropdownBlock(spec: VariableDropdownBlock): void {
  if (declarations.some((d) => d.blockType === spec.blockType)) return
  declarations.push(spec)
}

/**
 * 全部宣告，給介面層讀。
 *
 * **空的代表沒有語言套件載入過**——不是「沒有這種積木」。介面層照著空清單
 * 跑不會出錯，但那些積木不會被註冊，使用者會看到「未知積木」。
 */
export function allVariableDropdownBlocks(): readonly VariableDropdownBlock[] {
  return declarations
}
