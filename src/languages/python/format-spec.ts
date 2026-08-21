/**
 * **Python 的格式規格**（`f"{x:>8.2f}"` 冒號後面那一段），一份。
 *
 * ## 為什麼要獨立一個模組
 *
 * 它有**兩個消費者**：格式化文字的每一格（`python:string_insert`）與
 * `"…".format(...)`。而它們在 2026-08-22 之前**各自只做了一小塊**：
 * 前者只認 `.Nf`、後者只認 `{}`。
 *
 * > **兩份真相不會同時錯，它們會【各自】對一半——而那時兩邊的測試都是綠的。**
 *
 * ## 支援到哪裡，以及**認不得的一律丟錯**
 *
 * ```
 * [[填充]對齊][正負號][0][寬度][,][.精度][型別]
 *   對齊  <  >  ^          型別  d f s % e b o x
 * ```
 *
 * 🔴 **認不得的格式【丟錯】，不是靜默照原樣印**：靜默的話 `f"{x:>10}"`
 * 會印出沒有補齊的字，而畫面上看不出哪裡不對——第三十三條護欄要防的
 * 就是這種「與合法結果無法區分的預設值」。
 */
import type { RuntimeValue } from '../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../interpreter/errors'
import { pythonDisplay } from './value-display'

/** `[[fill]align][sign][#][0][width][,][.precision][type]` */
const SPEC = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?(,)?(?:\.(\d+))?([bdoxXeEfFgGs%])?$/

const asNumber = (v: RuntimeValue): number => {
  if (v?.type === 'bool') return v.value ? 1 : 0
  return Number(v?.value)
}

/**
 * 套一段格式規格。
 *
 * @throws 認不得的規格 → `UNSUPPORTED_FORMAT`（**不靜默**）
 */
export function applyFormatSpec(v: RuntimeValue, spec: string): string {
  if (spec === '') return pythonDisplay(v)
  const m = SPEC.exec(spec)
  if (!m) throw new RuntimeError(RUNTIME_ERRORS.UNSUPPORTED_FORMAT, { '%1': spec })
  const [, fillRaw, alignRaw, sign, , zero, widthRaw, comma, precRaw, type] = m

  // ⚠️ **數字的預設對齊是靠右，其餘靠左**——那是 Python 的規則，
  //    而弄反的症狀是「有補齊而補在另一邊」：看得見，卻不像錯誤。
  const numeric = type !== undefined && type !== 's'
    ? true
    : type === 's' ? false
    : v?.type === 'int' || v?.type === 'double' || v?.type === 'float' || v?.type === 'bool'

  let body: string
  if (type === 'f' || type === 'F') {
    body = asNumber(v).toFixed(precRaw === undefined ? 6 : Number(precRaw))
  } else if (type === 'd') {
    const n = asNumber(v)
    if (!Number.isInteger(n)) throw new RuntimeError(RUNTIME_ERRORS.UNSUPPORTED_FORMAT, { '%1': `${spec}（小數配 d）` })
    body = String(n)
  } else if (type === 'e' || type === 'E') {
    body = asNumber(v).toExponential(precRaw === undefined ? 6 : Number(precRaw))
    if (type === 'E') body = body.toUpperCase()
  } else if (type === 'b' || type === 'o' || type === 'x' || type === 'X') {
    const radix = type === 'b' ? 2 : type === 'o' ? 8 : 16
    const n = Math.trunc(asNumber(v))
    body = Math.abs(n).toString(radix)
    if (type === 'X') body = body.toUpperCase()
    if (n < 0) body = `-${body}`
  } else if (type === '%') {
    body = `${(asNumber(v) * 100).toFixed(precRaw === undefined ? 6 : Number(precRaw))}%`
  } else if (type === 'g' || type === 'G') {
    body = String(asNumber(v))
  } else if (precRaw !== undefined && !numeric) {
    body = pythonDisplay(v).slice(0, Number(precRaw))
  } else if (precRaw !== undefined) {
    // `{:.2}` 對數字在 Python 是有效位數——教學語料裡不出現，**不要猜**
    throw new RuntimeError(RUNTIME_ERRORS.UNSUPPORTED_FORMAT, { '%1': `${spec}（數字的有效位數）` })
  } else {
    body = pythonDisplay(v)
  }

  // 千分位
  if (comma) {
    const [intPart, frac] = body.split('.')
    const negative = intPart.startsWith('-')
    const digits = negative ? intPart.slice(1) : intPart
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    body = `${negative ? '-' : ''}${grouped}${frac === undefined ? '' : `.${frac}`}`
  }

  // 正負號
  if (numeric && sign && !body.startsWith('-')) {
    if (sign === '+') body = `+${body}`
    else if (sign === ' ') body = ` ${body}`
  }

  const width = widthRaw === undefined ? 0 : Number(widthRaw)
  if (body.length >= width) return body

  const pad = width - body.length
  const align = alignRaw ?? (zero ? '=' : numeric ? '>' : '<')
  const fill = fillRaw ?? (zero ? '0' : ' ')

  // 🔴 `=` 是「填充放在正負號【後面】」——`f"{-5:05d}"` 是 `-0005` 不是 `000-5`
  if (align === '=') {
    const neg = /^[-+ ]/.exec(body)
    return neg ? neg[0] + fill.repeat(pad) + body.slice(1) : fill.repeat(pad) + body
  }
  if (align === '>') return fill.repeat(pad) + body
  if (align === '<') return body + fill.repeat(pad)
  const left = Math.floor(pad / 2)
  return fill.repeat(left) + body + fill.repeat(pad - left)
}
