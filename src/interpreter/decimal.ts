/**
 * **十進位的四捨五入，而收尾照 C 的規矩**（2026-09-18）。
 *
 * ## 🔴 它從哪來
 *
 * `cout` 的浮點格式對上 g++ 之後還差最後一格——**平手的時候往哪邊走**：
 *
 * ```
 *              g++      JS
 * 2.5  → 0 位   2        3
 * 0.5  → 0 位   0        1
 * 0.25 → 1 位   0.2      0.3
 * 1.25 → 2 位有效 1.2     1.3
 * 3.5  → 0 位   4        4      ← 這一格兩邊一樣，而那正是它難被發現的原因
 * ```
 *
 * C 的預設捨入模式是**逢五取偶**（round-half-to-even），JS 的 `toFixed`／
 * `toPrecision`／`toExponential` 是**逢五進位**。
 *
 * ⚠️ 而兩者**只在精確的平手上不同**——`0.35` 在二進位裡略小於 0.35，
 * 所以兩邊都給 `0.3`。**一半的測資會讓這個差別隱形。**
 *
 * > **一個只在「剛好一半」時才不同的規則，測資裡沒有整齊的數字就永遠不會紅。**
 *
 * ## ⚠️ 它的界線（寫下來，不要假裝沒有）
 *
 * 判斷「是不是精確的平手」靠的是把值展開到**多 20 位**再看後面是不是 `5000…0`。
 * 一個真實的 double 如果它的精確展開在那 20 位之後還有非零位，這裡會判成平手
 * ——那需要一個十進位展開超過 `d+20` 位而前 `d+20` 位剛好是 `5000…0` 的值。
 * **實務上碰不到，而它是一個近似，不是一個定理。**
 */

/**
 * 把 `n` 四捨五入到**小數點後 `d` 位**，平手時取偶。
 *
 * 回傳字串（不是數字）——因為「2 位」與「2.00 位」在輸出上是兩回事，
 * 而一個 `number` 說不出自己要印幾位。
 */
export function toFixedHalfEven(n: number, d: number): string {
  if (!Number.isFinite(n)) return String(n)
  const neg = n < 0
  const a = Math.abs(n)
  // ⚠️ `toFixed` 的上限是 100 位。多取 20 位是為了看得到「後面還有沒有東西」。
  const wide = a.toFixed(Math.min(100, d + 20))
  const dot = wide.indexOf('.')
  const intPart = dot < 0 ? wide : wide.slice(0, dot)
  const frac = dot < 0 ? '' : wide.slice(dot + 1)
  const keep = frac.slice(0, d).padEnd(d, '0')
  const rest = frac.slice(d)
  const first = rest[0] ?? '0'
  const exactHalf = first === '5' && /^0*$/.test(rest.slice(1))
  const digits = intPart + keep
  const lastKept = digits.charCodeAt(digits.length - 1) - 48
  const up = first > '5'
    || (first === '5' && !exactHalf)
    // 🔴 **精確的平手 → 取偶**：最後一位是奇數才進位。
    || (exactHalf && lastKept % 2 === 1)
  const rounded = up ? bumpDigits(digits) : digits
  const cut = rounded.length - d
  const out = d > 0 ? `${rounded.slice(0, cut) || '0'}.${rounded.slice(cut)}` : rounded
  return neg && /[1-9]/.test(rounded) ? `-${out}` : out
}

/** 一串十進位數字加一——⚠️ 會變長（`999` → `1000`），呼叫端要照著切。 */
function bumpDigits(s: string): string {
  const a = s.split('')
  let i = a.length - 1
  for (; i >= 0; i--) {
    if (a[i] === '9') { a[i] = '0'; continue }
    a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1)
    break
  }
  return i < 0 ? '1' + a.join('') : a.join('')
}

/**
 * 把 `n` 寫成 `尾數e±指數`，尾數保留 `p` 位有效數字，平手時取偶，
 * 指數**補成至少兩位**（C 的最小寬度）。
 */
export function toExponentialHalfEven(n: number, p: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (n === 0) return p > 0 ? `0.${'0'.repeat(p)}e+00` : '0e+00'
  const a = Math.abs(n)
  // 指數要在**四捨五入之後**算——`999999.5` 進位之後跨過一位。
  let exp = Number(a.toExponential(Math.min(20, p)).split('e')[1])
  let mant = toFixedHalfEven(a / 10 ** exp, p)
  // ⚠️ 尾數進位成 `10.00` 時要把那一位還給指數。
  if (Number(mant) >= 10) { exp += 1; mant = toFixedHalfEven(a / 10 ** exp, p) }
  const sign = exp < 0 ? '-' : '+'
  return `${n < 0 ? '-' : ''}${mant}e${sign}${String(Math.abs(exp)).padStart(2, '0')}`
}

/**
 * C 的 `%g`：**指數 < -4 或 ≥ 有效位數**時用科學記號，否則用小數；兩者都**去尾零**。
 *
 * ⚠️ 這是 `cout` 預設的寫法，也是 `setprecision(n)` 在沒有選「固定小數」時的寫法
 * ——**同一條規則，位數是參數**。
 */
export function toSignificant(n: number, p: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (n === 0) return '0'
  const digits = Math.max(1, Math.min(21, p))
  const exp = Number(Math.abs(n).toExponential(Math.min(20, digits - 1)).split('e')[1])
  if (exp < -4 || exp >= digits) {
    const t = toExponentialHalfEven(n, digits - 1)
    const e = t.indexOf('e')
    // 去尾零：`1.00000e+09` → `1e+09`
    const mant = t.slice(0, e).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    return mant + t.slice(e)
  }
  const fixed = toFixedHalfEven(n, Math.max(0, digits - 1 - exp))
  return fixed.includes('.')
    ? fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    : fixed
}
