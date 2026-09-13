/**
 * **簽名上的預設值原文讀成一個值**——`void f(int n = 3)` 的那個 `3`。
 *
 * 🔴 **它本來整個沒有被讀**：少給引數時綁的是**型別的零值**，於是
 * `add(1)` 在 `int add(int a, int b = 10)` 底下算出 1（真的 C++ 是 11）
 * ——不報錯、有輸出、而答案錯（2026-08-23 由 C++ 語料的形狀覆蓋抓到）。
 *
 * ⚠️ **只認字面**（數字／字元／字串／`true`／`false`／`nullptr`）。
 * 認不得的（`= f()`／`= x + 1`）**丟錯**：靜默當成零值會讓一個
 * 完全正確的程式安靜地算錯。
 *
 * > **與 Python 那側同一條規則**——而兩邊都記著同一筆債：
 * > 一個要 parse 回結構才能用的字串，就不該是字串。
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function cppParamDefault(raw: string): RuntimeValue {
  const t = raw.trim()
  if (/^-?\d+$/.test(t)) return { type: 'int', value: Number(t) }
  if (/^-?\d*\.\d+f?$/.test(t)) return { type: 'double', value: Number(t.replace(/f$/, '')) }
  if (t === 'true' || t === 'false') return { type: 'bool', value: t === 'true' }
  if (/^'(\\.|[^'])'$/.test(t)) {
    const inner = t.slice(1, -1)
    const esc: Record<string, string> = { '\\n': '\n', '\\t': '\t', '\\0': '\0', "\\'": "'", '\\\\': '\\' }
    return { type: 'char', value: esc[inner] ?? inner }
  }
  if (/^".*"$/s.test(t)) return { type: 'string', value: t.slice(1, -1) }
  if (t === 'nullptr' || t === 'NULL') return { type: 'pointer', value: null }
  throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
    '%1': `預設值 ${t}（只認得字面：數字／字元／字串／true／false／nullptr）`,
  })
}
