/**
 * Python 的二元運算語義——**抽出來給別人用**。
 *
 * ## 為什麼不讓別人自己寫一份
 *
 * 複合指派（`total += i`）就是「取值、運算、寫回」，而中間那一步**必須是
 * Python 的規則**：
 *
 * ```
 * + - * // %      兩邊都是整數 → 整數；否則小數
 * /               🔴 【永遠】是小數 —— `7 / 2` 是 3.5
 * %               🔴 跟著【除數】的正負號 —— `-7 % 3` 是 2
 * "ab" * 3        字串重複
 * ```
 *
 * 這些規則有**四條**是這個專案實測踩過的（`5+3` 印出 `8.0`、`-7 % 3` 得 `2.0`、
 * `"ab" * 3` 靜靜回 `0.0`）。**再抄一份，就是再踩一次的邀請。**
 *
 * > **兩份真相不會同時錯，它們會【先後】錯——而修好的那一份會讓另一份更難被發現。**
 */
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/**
 * ⚠️ **布林在 Python 是整數的一種**——`True + True` 是 `2` 不是 `2.0`。
 * 少了 `'bool'` 的症狀是那個 `.0`：**不報錯、看起來只是排版**，
 * 而它是型別錯了。參照直譯器抓到的。
 */
const isInt = (r: RuntimeValue): boolean => r.type === 'int' || r.type === 'char' || r.type === 'bool'

/** `ctx` 只用到數值轉換這一件事，所以只要這麼窄的介面。 */
export interface numberCoercion { toNumber(v: RuntimeValue): number }

export function applyPythonBinary(
  op: string,
  l: RuntimeValue,
  r: RuntimeValue,
  ctx: numberCoercion,
): RuntimeValue {
  // ── 字串的運算：Python 有【兩個】，而它們的形狀完全不同 ──
  if (l.type === 'string' || r.type === 'string') {
    if (op === '+' && l.type === 'string' && r.type === 'string') {
      return { type: 'string', value: String(l.value) + String(r.value) }
    }
    // 🔴 `"%s hi" % name` —— **字串的 `%` 是格式化，不是取餘數**。
    //    AI 生的 Python 兩種格式化都會出現（`.format()` 是另一種）。
    //    ⚠️ 不接的症狀是「文字不能做 %」——**那句話對取餘數是對的，
    //    而使用者寫的根本不是取餘數**。
    if (op === '%' && l.type === 'string') {
      const args = r.type === 'array' ? (r.value as RuntimeValue[]) : [r]
      let i = 0
      return {
        type: 'string',
        value: String(l.value).replace(/%[sdif]/g, () => {
          const v = args[i++]
          return v === undefined ? '' : v.type === 'bool' ? (v.value ? 'True' : 'False') : String(v.value)
        }),
      }
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

  // ── 串列的運算：Python 有【兩個】，而它們與數字的同名運算不同 ──
  //
  // ⚠️ **這一段要排在字串那一段【之後】**：`"%s %s" % (a, b)` 的右邊是一個
  //    tuple——也就是一個串列——而它要走的是**字串的格式化**那條路。
  //    排在前面的話那種寫法會被判成「串列不能做 %」。
  //
  // 🔴 `[0] * 3` 與 `[1,2] + [3]`。少了它們的症狀是**靜靜回 `0.0`**
  //    （`toNumber` 對串列給 NaN，而 NaN 走完整個 switch 沒有人攔）
  //    ——`[[0] * 2 for _ in range(3)]` 這個「建二維表」的慣用寫法整段崩掉。
  //
  // ⚠️ **乘出來的每一格是【同一個】值**，那正是 Python 自己的行為
  //    （`g = [[0] * 2] * 3` 之後改一格會三列一起變）——所以這裡不深拷貝。
  if (l.type === 'array' || r.type === 'array') {
    if (op === '+' && l.type === 'array' && r.type === 'array') {
      return { type: 'array', value: [...(l.value as RuntimeValue[]), ...(r.value as RuntimeValue[])] }
    }
    if (op === '*') {
      const xs = (l.type === 'array' ? l : r).value as RuntimeValue[]
      const cnt = l.type === 'array' ? r : l
      if (cnt.type !== 'array') {
        const n = Math.trunc(ctx.toNumber(cnt))
        const out: RuntimeValue[] = []
        for (let i = 0; i < n; i++) out.push(...xs)
        return { type: 'array', value: out }
      }
    }
    // 其餘的在 Python 是 TypeError —— **出聲**，不要轉成數字。
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
      '%1': `串列不能做 ${op}（Python 會說 TypeError）`,
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
}
