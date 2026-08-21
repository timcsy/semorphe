/**
 * `python:arithmetic` 的 **execute** 路。
 *
 * ## 🔴 整數與小數的規則，是這個語言最容易被抄錯的一格
 *
 * ```
 * + - * // %      兩邊都是整數 → 整數；否則小數
 * /               🔴 【永遠】是小數 —— `7 / 2` 是 3.5，而 C++ 的是 3
 * **              指數是非負整數且底數是整數 → 整數
 * ```
 *
 * ⚠️ 全部回 `double` 的症狀不是崩潰，是 **`print(5 + 3)` 印出 `8.0`**
 * ——而那要打開瀏覽器（或跑一次）才看得到。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

const isInt = (r: RuntimeValue): boolean => r.type === 'int' || r.type === 'char'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:arithmetic', async (node, ctx) => {
    const op = String(node.properties.operator ?? '+')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])

    // ── 字串的運算：Python 有【兩個】，而它們的形狀完全不同 ──
    //
    // 🔴 第一版只處理了 `+`，於是 `"ab" * 3` 掉進下面的數值運算
    // ——`toNumber("ab")` 是 NaN，`NaN * 3` 是 NaN，而它**靜靜印出 `0.0`**。
    //
    // > **一個靜默的錯答案，比一個拋出來的錯誤貴得多
    // > ——因為使用者會拿它去算下一步。**
    //
    // 抓到它的是盲測（`fuzz_10`），而**十二題裡只有那一題碰到它**。
    if (l.type === 'string' || r.type === 'string') {
      if (op === '+' && l.type === 'string' && r.type === 'string') {
        return { type: 'string', value: String(l.value) + String(r.value) }
      }
      // `"ab" * 3` / `3 * "ab"` —— 字串重複。次數要是整數。
      if (op === '*') {
        const str = l.type === 'string' ? String(l.value) : String(r.value)
        const cnt = l.type === 'string' ? r : l
        if (cnt.type !== 'string') {
          const n = Math.trunc(ctx.toNumber(cnt))
          return { type: 'string', value: n > 0 ? str.repeat(n) : '' }
        }
      }
      // 其餘的字串運算在 Python 是 TypeError —— **出聲**，不要轉成數字。
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
        '%1': `文字不能做 ${op}（Python 會說 TypeError）`,
      })
    }

    const a = ctx.toNumber(l), b = ctx.toNumber(r)
    const bothInt = isInt(l) && isInt(r)
    const num = (v: number, forceFloat = false): RuntimeValue =>
      ({ type: !forceFloat && bothInt ? 'int' : 'double', value: v })
    const nonZero = (): void => {
      if (b === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO, {})
    }

    switch (op) {
      case '+': return num(a + b)
      case '-': return num(a - b)
      case '*': return num(a * b)
      // 🔴 `/` 【永遠】回小數 —— 與 C++ 的整數除法不同。
      case '/': nonZero(); return num(a / b, true)
      case '//': nonZero(); return num(Math.floor(a / b))
      // Python 的取餘數跟著【除數】的正負號 —— `-7 % 3` 是 2，不是 -1。
      case '%': nonZero(); return num(((a % b) + b) % b)
      // 負指數會得到小數（`2 ** -1` 是 0.5）。
      case '**': return num(a ** b, b < 0)
      default:
        // 判不出來就丟錯，不要回 0。
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
    }
  })
}
