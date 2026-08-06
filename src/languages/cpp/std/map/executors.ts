/**
 * `<map>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 2 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'
import { defaultValue } from '../../../../interpreter/types'
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

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_map_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_map_access', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return defaultValue('int')
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      return defaultValue('int')
    }
    const idx = mapFind(map.value, keyVal)
    if (idx === -1) {
      // C++ map auto-inserts default on access
      const newVal = defaultValue('int')
      const pair: RuntimeValue = { type: 'array', value: [keyVal, newVal] }
      map.value.push(pair)
      return newVal
    }
    const pair = map.value[idx]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 2) {
      return pair.value[1]
    }
    return defaultValue('int')
  })

  // ─── Set (simulated with array + uniqueness) ───
}
