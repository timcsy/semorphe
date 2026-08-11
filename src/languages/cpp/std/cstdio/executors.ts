/**
 * io 的語言專屬執行路——3 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import { valueToString } from '../../../../interpreter/types'
import type { RuntimeValue } from '../../../../interpreter/types'

/**
 * ⚠️ **這個模組不再註冊任何執行器**——`print_formatted` 與 `input_formatted`
 * 都搬進膠囊了。檔案留著因為裡面還有共用的東西（見下面的匯出）。
 */

/** Format a printf-style string with runtime values */
export function formatPrintf(format: string, args: RuntimeValue[]): string {
  let argIdx = 0
  let result = format.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')

  result = result.replace(/%([0-9]*\.?[0-9]*)?[diouxXeEfgGcsplnDOUaA%]/g, (match) => {
    if (match === '%%') return '%'
    if (argIdx >= args.length) return match

    const val = args[argIdx++]
    const numVal = typeof val.value === 'number' ? val.value : parseFloat(String(val.value))

    const precMatch = match.match(/^%([0-9]*)\.?([0-9]*)([a-zA-Z])$/)
    const specChar = precMatch ? precMatch[3] : match.charAt(match.length - 1)
    const precision = precMatch?.[2] ? parseInt(precMatch[2]) : undefined

    switch (specChar) {
      case 'd': case 'i': case 'l':
        return String(Math.trunc(isNaN(numVal) ? 0 : numVal))
      case 'f': case 'F':
        return (isNaN(numVal) ? 0 : numVal).toFixed(precision ?? 6)
      case 'e': case 'E':
        return (isNaN(numVal) ? 0 : numVal).toExponential(precision ?? 6)
      case 'g': case 'G':
        return (isNaN(numVal) ? 0 : numVal).toPrecision(precision ?? 6)
      case 'c':
        return typeof val.value === 'string' ? val.value.charAt(0) : String.fromCharCode(numVal)
      case 's':
        return valueToString(val)
      case 'x':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(16)
      case 'X':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(16).toUpperCase()
      case 'o':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(8)
      default:
        return valueToString(val)
    }
  })

  return result
}
