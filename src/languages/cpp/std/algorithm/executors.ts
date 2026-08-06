/**
 * `<algorithm>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 6 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 6 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_swap', async (node, ctx) => {
    const a = String(node.properties.a)
    const b = String(node.properties.b)
    const va = ctx.scope.get(a)
    const vb = ctx.scope.get(b)
    ctx.scope.set(a, vb)
    ctx.scope.set(b, va)
  })

  register('cpp_sort', async () => {})

  register('cpp_reverse', async () => {})

  register('cpp_fill', async () => {})

  register('cpp_min', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
    const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
    const na = ctx.toNumber(va)
    const nb = ctx.toNumber(vb)
    return na <= nb ? va : vb
  })

  register('cpp_max', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
    const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
    const na = ctx.toNumber(va)
    const nb = ctx.toNumber(vb)
    return na >= nb ? va : vb
  })
}
