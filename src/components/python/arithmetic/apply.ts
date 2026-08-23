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
// 🔴 「一樣不一樣」只有一份——與集合字面的去重同一個鍵
import { pythonDisplay } from '../../../languages/python/value-display'
// 🔴 「格式規格」只有一份——舊式的 `%.2f` 與新式的 `{:.2f}` 是同一套語義。
import { applyFormatSpec } from '../../../languages/python/format-spec'

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
      // 🔴 **舊式的格式也有旗標／寬度／精度**（`%.2f`、`%5d`、`%-10s`），
      //    而它們與新式的 `{:…}` 是**同一套語義**——所以翻譯過去，
      //    不要在這裡再寫一份。少了這一段的症狀是 `"%.2f" % x` 原樣印出
      //    `%.2f`（樣式沒被認出來）而 `%d` 不截斷小數。
      return {
        type: 'string',
        value: String(l.value).replace(/%(?:([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifeExXo%])|%)/g, (whole, flags: string, width: string, prec: string, type: string) => {
          if (whole === '%%') return '%'
          const v = args[i++]
          if (v === undefined) return ''
          const align = flags?.includes('-') ? '<' : ''
          const zero = flags?.includes('0') ? '0' : ''
          const sign = flags?.includes('+') ? '+' : flags?.includes(' ') ? ' ' : ''
          // `%i` 是 `%d` 的別名；`%s` 在新式裡也是 `s`
          const t = type === 'i' ? 'd' : type
          const spec = `${align}${sign}${zero}${width ?? ''}${prec === undefined ? '' : `.${prec}`}${t}`
          // ⚠️ `%d` 吃小數時 Python **截斷**（`%d % 92.456` 是 92），
          //    而新式的 `d` 對小數是錯誤——所以先截。
          const value = t === 'd' && typeof v.value === 'number' ? { ...v, type: 'int' as const, value: Math.trunc(v.value) } : v
          return applyFormatSpec(value, spec)
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
    // 🔴 **集合有自己的四個運算**（2026-08-23）：`&` 交集、`|` 聯集、
    //    `-` 差集、`^` 對稱差。⚠️ **兩邊都要是集合**——`{1} - [1]` 在真的
    //    Python 是 TypeError，而這裡照樣要出聲。
    //    ⚠️ 「一樣不一樣」用 `pythonDisplay` 當鍵，與集合字面的去重同一份規則。
    if (l.type === 'array' && r.type === 'array' && l.seqKind === 'set' && r.seqKind === 'set') {
      const xs = l.value as RuntimeValue[]
      const ys = r.value as RuntimeValue[]
      const keys = (vs: RuntimeValue[]): Set<string> => new Set(vs.map((v) => pythonDisplay(v)))
      const kx = keys(xs), ky = keys(ys)
      const pick = (vs: RuntimeValue[], want: (k: string) => boolean): RuntimeValue[] =>
        vs.filter((v) => want(pythonDisplay(v)))
      if (op === '&') return { type: 'array', value: pick(xs, (k) => ky.has(k)), seqKind: 'set' }
      if (op === '-') return { type: 'array', value: pick(xs, (k) => !ky.has(k)), seqKind: 'set' }
      if (op === '|') return { type: 'array', value: [...xs, ...pick(ys, (k) => !kx.has(k))], seqKind: 'set' }
      if (op === '^') {
        return {
          type: 'array', seqKind: 'set',
          value: [...pick(xs, (k) => !ky.has(k)), ...pick(ys, (k) => !kx.has(k))],
        }
      }
    }
    // 其餘的在 Python 是 TypeError —— **出聲**，不要轉成數字。
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
      '%1': `串列不能做 ${op}（Python 會說 TypeError）`,
    })
  }


  const a = ctx.toNumber(l), b = ctx.toNumber(r)
  const bothInt = isInt(l) && isInt(r)
  // ⚠️ **同一個符號在整數上是位元運算**（`5 & 3` ＝ 1）——集合那一段在上面先接走了。
  //    🔴 兩種意思一個符號是 Python 自己的設計，而抬升的時候看得到的只有形狀
  //    ——所以分岔一定在**執行期**，不可能在 lift。
  if (op === '<<' || op === '>>') {
    // ⚠️ **移位只在整數上有意義**（集合沒有「移位」這件事，所以不必先分岔）
    if (!bothInt) {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `${op} 只能用在兩個整數上` })
    }
    if (b < 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': '移位的位數不能是負的' })
    // 🔴 **不用 JS 的 `<<`**：它先把數字截成 32 位元，而 Python 的整數沒有位寬
    //    ——`1 << 40` 在 JS 的 `<<` 底下會變成 256。
    return { type: 'int', value: op === '<<' ? a * 2 ** b : Math.floor(a / 2 ** b) }
  }
  if (op === '&' || op === '|' || op === '^') {
    if (!bothInt) {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
        '%1': `${op} 只能用在兩個整數或兩個集合上`,
      })
    }
    const bits = op === '&' ? (a & b) : op === '|' ? (a | b) : (a ^ b)
    return { type: 'int', value: bits }
  }
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
