/**
 * `cpp:input_formatted` 的 **execute** 路（`scanf`）
 *
 * ⚠️ 它原本是 `std/cstdio/executors.ts` 裡一個叫 `execScanf` 的閉包。
 * `isIndexedAccess` 那一句原本寫死 `argNode.componentId === 'cpp:array_at'`
 * ——`scanf("%d", &arr[i])` 讀進來的值要寫回**陣列的某一格**，
 * 而那是 `array_at` 的性質，不是這顆該認得的身分。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { isIndexedAccess } from '../../../languages/cpp/core/node-traits'
import { defaultValue, parseInputValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  const execScanf: ComponentExecutor = async (node, ctx) => {
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

      if (isIndexedAccess(argNode.componentId)) {
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

  register('cpp:input_formatted', execScanf)
}
