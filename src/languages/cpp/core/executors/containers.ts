/**
 * C++ 語言核心中跨容器的泛用操作執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 7 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'
import { valueToString } from '../../../../interpreter/types'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
  const keyStr = valueToString(keyVal)
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 1) {
      if (valueToString(pair.value[0]) === keyStr) return i
    }
  }
  return -1
}

export function registerContainerCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_container_empty', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: arr.value.length === 0 }
  })

  register('cpp_container_push', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.push(val)
  })

  register('cpp_container_pop', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (arr.value.length > 0) {
      if (arr.tag === 'queue') {
        arr.value.shift()
      } else {
        arr.value.pop()
      }
    }
  })

  register('cpp_container_clear', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.length = 0
  })

  register('cpp_container_push_back', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.push(val)
  })

  register('cpp_container_erase', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return
    const keyVal = await ctx.evaluate(keyNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) return
    // Try map-style erase (key-value pairs) first
    const idx = mapFind(arr.value, keyVal)
    if (idx !== -1) {
      arr.value.splice(idx, 1)
      return
    }
    // Set-style erase (direct value match)
    const setIdx = arr.value.findIndex((v: RuntimeValue) => v.value === keyVal.value)
    if (setIdx !== -1) {
      arr.value.splice(setIdx, 1)
    }
  })

  register('cpp_container_count', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return { type: 'int' as const, value: 0 }
    const keyVal = await ctx.evaluate(keyNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'int' as const, value: 0 }
    }
    // Try map-style count (key-value pairs) first
    const idx = mapFind(arr.value, keyVal)
    if (idx !== -1) return { type: 'int' as const, value: 1 }
    // Set-style count (direct value match)
    const exists = arr.value.some((v: RuntimeValue) => v.value === keyVal.value)
    return { type: 'int' as const, value: exists ? 1 : 0 }
  })
}
