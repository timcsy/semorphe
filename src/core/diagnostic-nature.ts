/**
 * **每一條診斷規則的性質：形態、提示、判決**（vision〈形態檢查與判決的界線盤點〉，2026-11-09）。
 *
 * `Diagnostic.source` 回答「誰判的」（元件、剖析器、Cella）；這裡回答「它在說什麼」——兩件事不同：
 *
 * ```
 * 形態  semorphe 自己看得出的形狀問題，不涉及意思（名字合不合法、缺條件、插槽、語法）  ← 不違反「不判斷對錯」
 * 判決  Cella 判定程式的意思（編不過、未定義行為、型別接不上、名字沒宣告）           ← 意思歸 Cella
 * 提示  不是在說「你的程式錯了」：判斷功能的界線、步數用完、我們還沒支援的構造     ← 不該長得像錯誤
 * ```
 *
 * 例：`STREAM_OPERATOR_SUGGEST`（`cin << x`）由 Cella 判出、附了建議——它的性質是**判決**（程式編不過）；
 * `CELLA_UNSUPPORTED` 也由 Cella 給，性質是**提示**（是 Cella 判不了，不是學生錯了）。
 * 護欄 `audit-diagnostic-nature`：每一條會產出的規則都有性質（硬性零）；判決產出端的規則一條都不准標成形態；提示不准是 error。
 */
export type DiagnosticNature = 'form' | 'hint' | 'verdict'

const FORM = [
  'BAD_NAME_BAD_CHAR', 'BAD_NAME_EMPTY', 'BAD_NAME_RESERVED', 'BAD_NAME_STARTS_WITH_DIGIT',
  'MISSING_CONDITION', 'MISSING_VALUE', 'MISSING_VAR_NAME',
  'SLOT_TOO_FEW', 'SLOT_TOO_MANY', 'SLOT_WRONG_KIND',
  'SYNTAX_ERROR', 'SYNTAX_GAP', 'SYNTAX_OUTSIDE_FUNCTION',
  'SYNTAX_GAP_LIKELY',        // 推論出來的漏符號——程式確實有語法錯誤，只是位置是推論的（文案照實說「可能」）
  'VALUE_OUT_OF_RANGE',
] as const

const HINT = [
  'CELLA_UNSUPPORTED',        // Cella 還不支援這個構造
  'CELLA_FUEL',               // 步數用完——判不完，不是程式錯
  'CELLA_ORDER_UNCOMPARED',   // 兩種求值順序判斷功能沒有比較
  'CELLA_UNCLASSIFIED',       // Cella 沒有給種類（cos-mos 衍生原則 7：不由接收端猜）
  'CELLA_INVALID',            // 我們送的程式形狀不對——是我們的錯
] as const

const VERDICT = [
  'CELLA_REJECT', 'CELLA_NOT_ASSIGNABLE', 'CELLA_NOT_ASSIGNABLE_ARRAY', 'CELLA_NOT_ASSIGNABLE_CONST', 'CELLA_NOT_ASSIGNABLE_DELETED_COPY',
  'CELLA_NOT_ASSIGNABLE_FUNCTION', 'CELLA_CALL_ARGUMENTS', 'CELLA_CALL_ARGUMENTS_NO_MATCH', 'CELLA_CALL_ARGUMENTS_TOO_FEW',
  'CELLA_CALL_ARGUMENTS_TOO_MANY', 'CELLA_REDECLARED', 'CELLA_REDECLARED_FUNCTION', 'CELLA_REDECLARED_RETURN_TYPE',
  'CELLA_REDECLARED_TYPEDEF', 'CELLA_REDECLARED_VARIABLE', 'CELLA_RETURN_VALUE', 'CELLA_RETURN_VALUE_MISSING',
  'CELLA_RETURN_VALUE_UNEXPECTED', 'CELLA_OPERAND_TYPES', 'CELLA_NO_CONVERSION', 'CELLA_NO_CONVERSION_DISCARDS_CONST',
  'CELLA_UNDECLARED', 'CELLA_UNDECLARED_HEADER', 'CELLA_UNDECLARED_SUGGEST',
  'CELLA_UB_UNINIT', 'CELLA_UB_FLOW_OFF_END', 'CELLA_UB_PAST_END', 'CELLA_UB_PIN', 'CELLA_UB_BOUNDS', 'CELLA_UB_OVERFLOW',
  'CELLA_UB_DIV_ZERO', 'CELLA_UB_OVERLAP',
  'CELLA_UNSPECIFIED',        // 求值順序未指定而結果不只一種——程式的意思本身不確定（判決，不是判斷功能的界線）
  'CELLA_TERMINATION',        // 程式自己中止（abort、沒接住的例外）
  'CELLA_OTHER',              // 表外的種類：嚴重度照 Cella 給的類別，性質照判決
  'TYPE_MISMATCH', 'STREAM_OPERATOR_SUGGEST',
] as const

const TABLE: ReadonlyMap<string, DiagnosticNature> = new Map<string, DiagnosticNature>([
  ...FORM.map((r) => [r, 'form'] as const),
  ...HINT.map((r) => [r, 'hint'] as const),
  ...VERDICT.map((r) => [r, 'verdict'] as const),
])

/** 這條規則的性質；不在表上 ⟹ undefined（護欄要它是零）。 */
export function natureOf(rule: string): DiagnosticNature | undefined {
  return TABLE.get(rule)
}

/** 表上全部的規則（護欄用） */
export const NATURE_RULES: readonly string[] = [...TABLE.keys()]
