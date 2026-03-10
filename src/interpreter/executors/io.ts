import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { defaultValue, parseInputValue, valueToString } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerIoExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('print', async (node, ctx) => {
    const values = node.children.values ?? []
    for (const valNode of values) {
      const val = await ctx.evaluate(valNode)
      if (val.type === 'string' && val.value === '\n') {
        ctx.io.writeNewline()
      } else {
        ctx.io.write(valueToString(val))
      }
    }
  })

  register('input', async (node, ctx) => {
    const valueNodes = node.children.values ?? []
    if (valueNodes.length > 0) {
      let lastVal: RuntimeValue = { type: 'int', value: 0 }
      let itemsRead = 0
      for (const varRefNode of valueNodes) {
        if (varRefNode.concept === 'array_access') {
          const arrName = String(varRefNode.properties.name)
          const arr = ctx.scope.get(arrName)
          if (arr.type !== 'array' || !Array.isArray(arr.value)) {
            throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
          }
          const indexVal = await ctx.evaluate((varRefNode.children.index ?? [])[0])
          const index = ctx.toNumber(indexVal)
          const elemType = arr.value.length > 0 ? arr.value[0].type : 'int'
          let raw = ctx.readCinToken()
          if (raw === null) {
            const line = await ctx.awaitInput()
            if (line !== null) {
              const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
              ctx.scanfTokenBuffer.push(...tokens)
              raw = ctx.readCinToken()
            }
          }
          if (raw === null) return { type: 'int', value: 0 }
          lastVal = parseInputValue(raw, elemType) ?? defaultValue(elemType)
          itemsRead++
          if (index >= 0 && index < arr.value.length) {
            arr.value[index] = lastVal
          }
          continue
        }

        const varName = String(varRefNode.properties.name ?? 'x')
        let targetType = 'string'
        try { const existing = ctx.scope.get(varName); targetType = existing.type } catch { /* variable might not exist yet */ }

        let raw = ctx.readCinToken()
        if (raw === null) {
          const line = await ctx.awaitInput()
          if (line !== null) {
            const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
            ctx.scanfTokenBuffer.push(...tokens)
            raw = ctx.readCinToken()
          }
        }
        if (raw === null) return { type: 'int', value: 0 }
        lastVal = parseInputValue(raw, targetType) ?? defaultValue(targetType)
        itemsRead++
        ctx.scope.set(varName, lastVal)
      }
      return { type: 'int', value: itemsRead }
    }

    const targetType = String(node.properties.type || 'string')
    let raw = ctx.readCinToken()
    if (raw === null) {
      const line = await ctx.awaitInput()
      if (line !== null) {
        const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
        ctx.scanfTokenBuffer.push(...tokens)
        raw = ctx.readCinToken()
      }
    }
    if (raw === null) return { type: 'int', value: 0 }
    return parseInputValue(raw, targetType) ?? defaultValue(targetType)
  })

  register('cpp_printf', async (node, ctx) => {
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

      if (argNode.concept === 'array_access') {
        const arrName = String(argNode.properties.name)
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

  register('cpp_scanf', execScanf)
  register('cpp_scanf_expr', execScanf)
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
