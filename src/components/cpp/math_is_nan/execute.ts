/**
 * `cpp:math_is_nan` 的 **execute** 路。
 *
 * ⚠️ **`Number.isNaN` 不是 `isNaN`**：後者會把 `"abc"` 這種轉不成數字的東西
 * 也說成 NaN，而 C++ 的 `isnan` 只問「這個浮點數是不是 NaN」。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:math_is_nan', async (node, ctx) => {
    const v = await ctx.evaluate((node.children.value ?? [])[0])
    return { type: 'bool', value: Number.isNaN(ctx.toNumber(v)) }
  })
}
