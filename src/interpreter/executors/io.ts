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
}
