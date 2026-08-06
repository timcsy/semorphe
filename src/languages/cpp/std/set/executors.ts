/**
 * `<set>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 2 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_set_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_set_insert', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    // Uniqueness check: compare by value
    const exists = arr.value.some((v: RuntimeValue) => v.value === val.value)
    if (!exists) {
      arr.value.push(val)
      // Keep sorted (by value)
      arr.value.sort((a: RuntimeValue, b: RuntimeValue) => {
        if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value
        return String(a.value).localeCompare(String(b.value))
      })
    }
  })

  // ─── Generic container concepts (used by lifter for shared methods) ───
}
