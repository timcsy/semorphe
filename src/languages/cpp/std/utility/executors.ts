/**
 * `<utility>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 1 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 1 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:make_pair', async (node, ctx) => {
    const f = node.children.first?.[0]
    const s = node.children.second?.[0]
    const fv = f ? await ctx.evaluate(f) : { type: 'int' as const, value: 0 }
    const sv = s ? await ctx.evaluate(s) : { type: 'int' as const, value: 0 }
    return { type: 'string' as const, value: `(${fv.value}, ${sv.value})` }
  })
}
