/**
 * **一個被接住的錯誤，`print(e)` 印出來長什麼樣**——Python 的說法，一份。
 *
 * ## 為什麼要有這張表
 *
 * ```python
 * try:
 *     print(1 / 0)
 * except ZeroDivisionError as e:
 *     print("E:", e)          # 真 Python：E: division by zero
 * ```
 *
 * 而我們的錯誤帶的是**訊息代碼**（`RUNTIME_ERR_DIVISION_BY_ZERO`）
 * ——直接印出來的話學生看到的是**我們的內部詞彙**，而那個字串在
 * 任何一本 Python 教材裡都查不到。
 *
 * 🔴 **這張表住在語言套件裡，不在核心**：`division by zero` 是
 * **Python 對這件事的說法**，C++ 那側說的是別的。
 * 核心的錯誤碼是身分，這裡是它在這個語言底下的投影。
 *
 * ⚠️ **沒列到的碼回代碼本身，不要回空字串或猜一句**——一個猜出來的
 * 訊息與一個對的訊息長得一樣，而它會讓「這個錯誤還沒有 Python 的說法」
 * 這件事永遠沒有人發現。
 */
import { RuntimeError, RUNTIME_ERRORS } from '../../interpreter/errors'

/** 錯誤碼 → Python 自己印出來的那一句。 */
const PYTHON_EXCEPTION_TEXT: Record<string, string> = {
  [RUNTIME_ERRORS.DIVISION_BY_ZERO]: 'division by zero',
  [RUNTIME_ERRORS.INDEX_OUT_OF_RANGE]: 'list index out of range',
  [RUNTIME_ERRORS.TYPE_MISMATCH]: 'unsupported operand type(s)',
}

export function pythonExceptionText(e: unknown): string {
  if (!(e instanceof RuntimeError)) return e instanceof Error ? e.message : String(e)
  // 🔴 使用者自己丟的：`%1` 就是**他寫的那句話**
  if (e.i18nKey === RUNTIME_ERRORS.USER_RAISED) return String(e.params['%1'] ?? '')
  const known = PYTHON_EXCEPTION_TEXT[e.i18nKey]
  if (known) return known
  // 帶了一個說明用的參數時，那比代碼可讀
  if (typeof e.params['%1'] === 'string') return e.params['%1']
  return e.i18nKey
}
