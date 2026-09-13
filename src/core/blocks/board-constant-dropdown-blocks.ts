/**
 * 「這個積木的某個欄位，列出**目前這塊板子的具名常數**」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * `cpp_pin_constant` 的下拉本來靜態寫在 `forms/blocks.json`：
 * `HIGH LOW OUTPUT INPUT INPUT_PULLUP A0`——**六個選項，一份 Uno 的世界**。
 *
 * 而 spec `147` 之後，八塊板子的 `A0` 是**五個不同的值**，
 * D1 mini 還多九個 `D` 系名字，ESP32 真的沒有 `A1`／`A2`。
 *
 * > **UI 列出一個這塊板子上不存在的名字，是【發明】不是【發現】。**
 *
 * ## 分工——與 `variable-dropdown-blocks.ts` 同一個形狀
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 介面層 | **機制**——怎麼建一個惰性算選項的下拉，＋ 現在是哪塊板子 |
 * | 語言套件 | **名單**——哪些積木要用它、欄位叫什麼 |
 *
 * 🔴 **介面層不得認識任何具體的目標名字**（`'esp32'`、`'arduino-uno'`…）
 * ——`experience`：「要讓一個通用的層知道特例，辦法是讓特例自己帶著宣告來。」
 *
 * 見 `specs/148-board-constant-dropdown/`
 */

export interface BoardConstantDropdownBlock {
  /** 積木型別（也是它的概念身分導出的名字） */
  blockType: string
  /** 下拉選單所在的欄位名 */
  field: string
}

const declarations: BoardConstantDropdownBlock[] = []

/** 語言套件載入時呼叫 */
export function declareBoardConstantDropdown(spec: BoardConstantDropdownBlock): void {
  if (declarations.some((d) => d.blockType === spec.blockType && d.field === spec.field)) return
  declarations.push(spec)
}

/**
 * 全部宣告，給介面層讀。
 *
 * ⚠️ **空的代表沒有語言套件載入過**——不是「沒有這種積木」。
 */
export function allBoardConstantDropdowns(): readonly BoardConstantDropdownBlock[] {
  return declarations
}

/**
 * 這塊板子的選項名單——**沒有板子時回 `null`**，意思是「用宣告裡原本那份」。
 *
 * 🔴 **為什麼是 `null` 而不是一份預設清單**：
 * 那份預設清單會與 `forms/blocks.json` 裡的 `options` **一模一樣**
 * ——而兩份一樣的東西，遲早有一份會過期。
 *
 * > **一份宣告如果是另一份的投影，它就沒有資格當真相**（spec 144 同一課）。
 *
 * ⚠️ **不要排序**：`HIGH`／`LOW` 在前是刻意的，
 * 排序會把最常用的推到 `A10` 後面。
 */
export function boardConstantOptions(
  board?: { constants: Readonly<Record<string, number>> },
): string[] | null {
  return board ? Object.keys(board.constants) : null
}
