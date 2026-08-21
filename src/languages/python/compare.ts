/**
 * **Python 的比較語義**——一份。
 *
 * ## 三個消費者
 *
 * ```
 * a < b            比較運算子那顆元件
 * 0 < x < 10       串接比較那顆元件
 * sorted(xs)       排序（以及 max／min）
 * ```
 *
 * 🔴 而第三個**曾經是另一份**（2026-08-22）：內建函式表裡有一個自己的
 * `compare`，只認數字與字串。症狀是
 * `sorted(items, key=lambda p: (-p[1], p[0]))`——鍵是一個**序對**——
 * 排出來的順序是**原本的順序**：`toNumber` 對序對給 NaN，
 * 而所有的比較都變成 false。**不報錯、有輸出、而順序錯。**
 *
 * > **兩份真相不會同時錯，它們會【先後】錯——而修好的那一份會讓另一份更難被發現。**
 *
 * ## ⚠️ 它住在語言套件裡，不在元件的資料夾裡
 *
 * 「兩個值誰大」是 **Python 的規則**，而它的消費者橫跨元件與內建函式表
 * ——與「印出來長什麼樣」（`value-display.ts`）、「格式規格」
 * （`format-spec.ts`）同一類。
 */
import { RuntimeError, RUNTIME_ERRORS } from '../../interpreter/errors'
import type { RuntimeValue } from '../../interpreter/types'

/** `ctx` 只用到數值轉換這一件事，所以只要這麼窄的介面。 */
export interface numberCoercion { toNumber(v: RuntimeValue): number }

export function comparePython(op: string, l: RuntimeValue, r: RuntimeValue, ctx: numberCoercion): boolean {
  // 🔴 **等不等要先看型別**（2026-08-21）。
  //
  // 原本兩邊都走 `toNumber`，於是 `"" == None` 的兩邊都變成 0 而**相等**
  // ——真 Python 是 `False`。同樣地 `0 == "0"` 也會變成相等。
  //
  // ⚠️ 症狀是**不報錯、有輸出、而條件走錯邊**：參照直譯器抓到的。
  //
  // > **一個「先轉成數字再比」的等號，會讓所有轉出 0 的東西彼此相等。**
  if (op === '==' || op === '!=' || op === 'is' || op === 'is not') {
    const eq = pythonEquals(l, r)
    return op === '==' || op === 'is' ? eq : !eq
  }
  // 🔴 **序對逐格比**（`sorted(key=lambda p: (-p[1], p[0]))` 的鍵是一個 tuple）：
  //    先比第一格，相同才比第二格；前面都相同時短的比較小。
  //
  //    ⚠️ 少了它的症狀是**排序的順序錯而不報錯**——`toNumber` 對序對給 NaN，
  //    所有的比較都變成 false，於是它退化成「原本的順序」。
  //    **看起來像 `key=` 沒生效，其實是比較器不認得那種鍵。**
  if (l?.type === 'array' && r?.type === 'array') {
    const xs = l.value as RuntimeValue[], ys = r.value as RuntimeValue[]
    for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
      if (comparePython('<', xs[i], ys[i], ctx)) return op === '<' || op === '<='
      if (comparePython('>', xs[i], ys[i], ctx)) return op === '>' || op === '>='
    }
    if (xs.length === ys.length) return op === '<=' || op === '>='
    return xs.length < ys.length ? op === '<' || op === '<=' : op === '>' || op === '>='
  }

  // 兩邊都是字串時比字典序 —— Python 的字串是可比較的。
  const bothStr = l.type === 'string' && r.type === 'string'
  const a: string | number = bothStr ? String(l.value) : ctx.toNumber(l)
  const b: string | number = bothStr ? String(r.value) : ctx.toNumber(r)
  switch (op) {
    case '<': return a < b
    case '>': return a > b
    case '<=': return a <= b
    case '>=': return a >= b
    default: throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
  }
}

/**
 * Python 的相等。
 *
 * ```
 * 數字家族（int／float／bool）  互相比得動 —— `1 == True` 是 True
 * 其餘                          型別不同就不等 —— `"" == None` 是 False
 * 容器                          逐格比
 * ```
 *
 * ⚠️ **`is` 與 `==` 在這裡做同一件事**——這個直譯器沒有物件識別，
 * 而 `x is None` 是它唯一常見的用途，那個用途上兩者一致。
 * 🔴 寫在這裡而不是靜靜地做：`a is b` 對兩個內容相同的串列，
 * 真 Python 是 `False` 而我們是 `True`。
 */
function pythonEquals(l: RuntimeValue, r: RuntimeValue): boolean {
  const numeric = (v: RuntimeValue): boolean =>
    v.type === 'int' || v.type === 'double' || v.type === 'float' || v.type === 'bool' || v.type === 'char'
  if (numeric(l) && numeric(r)) return Number(l.value) === Number(r.value)
  if (l.type !== r.type) return false
  if (l.type === 'void') return true
  if (Array.isArray(l.value) && Array.isArray(r.value)) {
    const a = l.value as RuntimeValue[], b = r.value as RuntimeValue[]
    return a.length === b.length && a.every((x, i) => pythonEquals(x, b[i]))
  }
  return l.value === r.value
}

/**
 * 排序用的比較器——**同一份規則，換一個形狀**。
 *
 * ⚠️ 比較器必須**同步**（`Array.sort` 不吃 Promise），而 `comparePython`
 * 只需要一個數值轉換，所以這裡給它一個最小的。
 */
export function compareForSort(x: RuntimeValue, y: RuntimeValue): number {
  const ctx = { toNumber: (v: RuntimeValue): number => (v?.type === 'bool' ? (v.value ? 1 : 0) : Number(v?.value)) }
  if (comparePython('<', x, y, ctx)) return -1
  if (comparePython('>', x, y, ctx)) return 1
  return 0
}
