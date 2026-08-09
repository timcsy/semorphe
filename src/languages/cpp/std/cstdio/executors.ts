/**
 * io 的語言專屬執行路——3 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'
import { defaultValue, parseInputValue, valueToString } from '../../../../interpreter/types'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:printf', async (node, ctx) => {
    const format = String(node.properties.format ?? '')
    const argNodes = node.children.args ?? []
    const argValues: RuntimeValue[] = []
    for (const argNode of argNodes) {
      argValues.push(await ctx.evaluate(argNode))
    }
    const output = formatPrintf(format, argValues)
    ctx.io.write(output)
  })

  const execScanf: ConceptExecutor = async (node, ctx) => {
    const format = String(node.properties.format ?? '%d')
    const argNodes = node.children.args ?? []
    const specifiers = format.match(/%[^%]*?[diouxXeEfgGcsplnDOUaA]/g) ?? []

    let itemsRead = 0
    for (let i = 0; i < argNodes.length; i++) {
      const argNode = argNodes[i]
      const spec = specifiers[i] ?? '%d'

      let targetType = 'int'
      if (/[fFeEgGaA]/.test(spec)) targetType = 'double'
      else if (/[cs]/.test(spec)) targetType = spec.includes('c') ? 'char' : 'string'

      let raw = ctx.readScanfToken()
      if (raw === null) {
        const line = await ctx.awaitInput()
        if (line !== null) {
          const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
          ctx.scanfTokenBuffer.push(...tokens)
          raw = ctx.readScanfToken()
        }
      }
      if (raw === null) {
        return { type: 'int', value: itemsRead === 0 ? -1 : itemsRead }
      }
      const lastVal = parseInputValue(raw, targetType) ?? defaultValue(targetType)
      itemsRead++

      if (argNode.conceptId === 'cpp:array_access') {
        const arrName = String(argNode.properties.obj)
        const arr = ctx.scope.get(arrName)
        if (arr.type === 'array' && Array.isArray(arr.value)) {
          const indexVal = await ctx.evaluate((argNode.children.index ?? [])[0])
          const index = ctx.toNumber(indexVal)
          if (index >= 0 && index < arr.value.length) {
            arr.value[index] = lastVal
          }
        }
      } else {
        const varName = String(argNode.properties.name ?? 'x')
        if (targetType === 'int') {
          try { const existing = ctx.scope.get(varName); targetType = existing.type } catch { /* default int */ }
          const refinedVal = parseInputValue(raw!, targetType) ?? defaultValue(targetType)
          ctx.scope.set(varName, refinedVal)
        } else {
          ctx.scope.set(varName, lastVal)
        }
      }
    }
    return { type: 'int', value: itemsRead }
  }

  register('cpp:scanf', execScanf)

}

/** Format a printf-style string with runtime values */
function formatPrintf(format: string, args: RuntimeValue[]): string {
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
