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

export function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
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


  register('cpp:container_push', async (node, ctx) => {
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

  register('cpp:container_pop', async (node, ctx) => {
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








}
