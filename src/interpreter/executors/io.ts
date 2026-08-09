import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { defaultValue, parseInputValue, valueToString } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerIoExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:print', async (node, ctx) => {
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

  register('cpp:input', async (node, ctx) => {
    const valueNodes = node.children.values ?? []

    // `in >> a >> b` —— 來源是一個**字串串流變數**，不是標準輸入。
    // 串流的狀態是「還沒讀的 token」（見 std/sstream/executors.ts），
    // 每次讀取取走一個。
    const from = node.properties.from
    if (from !== undefined) {
      const streamName = String(from)
      const stream = ctx.scope.get(streamName)
      const tokens = Array.isArray(stream.value) ? [...(stream.value as RuntimeValue[])] : []
      for (const target of valueNodes) {
        const tok = tokens.shift()
        const name = String(target.properties.name)
        const cur = ctx.scope.has(name) ? ctx.scope.get(name) : { type: 'int' as const, value: 0 }
        // 依**目標變數的型別**轉換——與 C++ 的 `>>` 一致
        const parsed = tok === undefined
          ? cur
          : (parseInputValue(String(tok.value), cur.type) ?? cur)
        ctx.scope.set(name, parsed)
      }
      ctx.scope.set(streamName, { type: 'array', value: tokens })
      return
    }
    if (valueNodes.length > 0) {
      let lastVal: RuntimeValue = { type: 'int', value: 0 }
      let itemsRead = 0
      for (const varRefNode of valueNodes) {
        if (varRefNode.conceptId === 'cpp:array_access') {
          const arrName = String(varRefNode.properties.obj)
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
