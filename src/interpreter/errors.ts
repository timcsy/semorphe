/** 執行期錯誤，包含 i18n key 和插值參數 */
export class RuntimeError extends Error {
  readonly i18nKey: string
  readonly params: Record<string, string>
  readonly nodeId: string | null

  constructor(i18nKey: string, params: Record<string, string> = {}, nodeId: string | null = null) {
    const fallback = i18nKey + (Object.keys(params).length > 0 ? ': ' + JSON.stringify(params) : '')
    super(fallback)
    this.name = 'RuntimeError'
    this.i18nKey = i18nKey
    this.params = params
    this.nodeId = nodeId
  }
}

/** i18n key 常數 */
export const RUNTIME_ERRORS = {
  UNDECLARED_VAR: 'RUNTIME_ERR_UNDECLARED_VAR',
  /**
   * 同一件事，而**可見範圍裡有一個長得很像的名字**（2026-08-17）。
   * ⚠️ 分成兩個身分而不是加一個可選參數——那樣「有沒有建議」會藏在
   * 參數裡，而**第四十四條護欄量的是 (身分, 參數) 組合**，看不見它。
   */
  UNDECLARED_VAR_SUGGEST: 'RUNTIME_ERR_UNDECLARED_VAR_SUGGEST',
  /**
   * **它根本不是一個變數**——例如 C++ 的 `cout`（2026-08-17）。
   * ⚠️ 身分在核心，而**判斷「哪些名字是串流」在語言套件裡**
   * （中立性護欄：`src/interpreter` 不得硬編特定語言的名字）。
   */
  STREAM_NOT_VARIABLE: 'RUNTIME_ERR_STREAM_NOT_VARIABLE',
  /** 同上，而**名字本身也打錯了**（`Cout`）。 */
  STREAM_NOT_VARIABLE_SUGGEST: 'RUNTIME_ERR_STREAM_NOT_VARIABLE_SUGGEST',
  DIVISION_BY_ZERO: 'RUNTIME_ERR_DIVISION_BY_ZERO',
  MAX_STEPS_EXCEEDED: 'RUNTIME_ERR_MAX_STEPS',
  TYPE_MISMATCH: 'RUNTIME_ERR_TYPE_MISMATCH',
  INDEX_OUT_OF_RANGE: 'RUNTIME_ERR_INDEX_OUT_OF_RANGE',
  UNDEFINED_FUNCTION: 'RUNTIME_ERR_UNDEFINED_FUNC',
  BREAK_OUTSIDE_LOOP: 'RUNTIME_ERR_BREAK_OUTSIDE_LOOP',
  CONTINUE_OUTSIDE_LOOP: 'RUNTIME_ERR_CONTINUE_OUTSIDE_LOOP',
  DUPLICATE_DECLARATION: 'RUNTIME_ERR_DUPLICATE_DECLARATION',
  ABORTED: 'RUNTIME_ERR_ABORTED',
  UNKNOWN_COMPONENT: 'RUNTIME_ERR_UNKNOWN_COMPONENT',
  /** 辨識不出來的原始程式碼被執行到——**不能靜靜略過** */
  UNRECOGNIZED_CODE: 'RUNTIME_ERR_UNRECOGNIZED_CODE',
  /**
   * 程式想讀一行輸入，而已經沒有輸入了。
   *
   * 🔴 **這一格原本被 `UNRECOGNIZED_CODE` 兼著用**，於是使用者按執行、
   * 主控台印出提示、然後跳出**「這一段程式我看不懂」**——
   * 而程式碼一點問題都沒有，只是他還沒打字。
   *
   * > **一個錯誤代碼被拿去兼差時，它的訊息會對著一個完全不同的情境說話
   * > ——而那個訊息會把使用者送去改一段沒有壞的程式碼。**
   *
   * （Python 的 `input()` 在這個情況丟 `EOFError`；C++ 那側目前是靜默回 0，
   * 而那是另一筆記在帳上的債。）
   */
  NO_MORE_INPUT: 'RUNTIME_ERR_NO_MORE_INPUT',
  /**
   * 整個程式沒有任何進入點。
   *
   * 🔴 **在此之前這個情況是【安靜結束】的**，而那讓「找不到進入點」
   * 與「跑完了什麼都沒印」在報表上長得一模一樣
   * ——十段 Arduino 語料因此被誤報成「跑完了」。
   */
  NO_ENTRY_POINT: 'RUNTIME_ERR_NO_ENTRY_POINT',
} as const
