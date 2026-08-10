/**
 * `<queue>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 3 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { defaultValue } from '../../../../interpreter/types'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {




  register('cpp:priority_queue_peek', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    // 最大值——**不是** arr.value[0]
    return arr.value.reduce((max, v) =>
      Number(v.value) > Number(max.value) ? v : max,
    )
  })

  register('cpp:queue_front', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[0]
  })

  // ─── Map (simulated with array of [key, value] pairs) ───
}
