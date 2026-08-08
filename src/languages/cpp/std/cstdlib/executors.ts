/**
 * `<cstdlib>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 6 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 6 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:rand', async () => ({ type: 'int' as const, value: Math.floor(Math.random() * 32768) }))

  register('cpp:srand', async () => {}) // seed ignored in JS

  register('cpp:abs', async (node, ctx) => {
    const v = node.children.value?.[0]
    if (!v) return { type: 'int' as const, value: 0 }
    const val = await ctx.evaluate(v)
    return { type: val.type, value: Math.abs(ctx.toNumber(val)) }
  })

  register('cpp:exit', async () => { throw new RuntimeError(RUNTIME_ERRORS.ABORTED) })

  register('cpp:atoi', async (node, ctx) => {
    const v = node.children.str?.[0]
    if (!v) return { type: 'int' as const, value: 0 }
    const val = await ctx.evaluate(v)
    return { type: 'int' as const, value: parseInt(String(val.value), 10) || 0 }
  })

  register('cpp:atof', async (node, ctx) => {
    const v = node.children.str?.[0]
    if (!v) return { type: 'double' as const, value: 0.0 }
    const val = await ctx.evaluate(v)
    return { type: 'double' as const, value: parseFloat(String(val.value)) || 0.0 }
  })
}
