/**
 * `<numeric>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 5 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 5 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_accumulate', async () => ({ type: 'int' as const, value: 0 }))

  register('cpp_iota', async () => {}) // statement, modifies container in-place

  register('cpp_partial_sum', async () => {}) // statement, modifies destination container

  register('cpp_gcd', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? ctx.toNumber(await ctx.evaluate(a)) : 0
    const vb = b ? ctx.toNumber(await ctx.evaluate(b)) : 0
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
    return { type: 'int' as const, value: gcd(Math.abs(va), Math.abs(vb)) }
  })

  register('cpp_lcm', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? ctx.toNumber(await ctx.evaluate(a)) : 0
    const vb = b ? ctx.toNumber(await ctx.evaluate(b)) : 0
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
    const g = gcd(Math.abs(va), Math.abs(vb))
    return { type: 'int' as const, value: g === 0 ? 0 : Math.abs(va * vb) / g }
  })
}
