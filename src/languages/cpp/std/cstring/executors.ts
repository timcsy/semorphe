/**
 * `<cstring>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/strings.ts`，讓核心層認識了 10 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_strlen', async (node, ctx) => {
    const strNodes = node.children.str ?? []
    if (strNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(strNodes[0])
    return { type: 'int', value: String(val.value).length }
  })

  register('cpp_strcmp', async (node, ctx) => {
    const s1Nodes = node.children.s1 ?? []
    const s2Nodes = node.children.s2 ?? []
    const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
    const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
    if (s1 < s2) return { type: 'int', value: -1 }
    if (s1 > s2) return { type: 'int', value: 1 }
    return { type: 'int', value: 0 }
  })

  register('cpp_strcpy', async () => {})

  register('cpp_strcat', async () => {})

  register('cpp_strncpy', async () => {})

  register('cpp_strncmp', async (node, ctx) => {
    const s1Nodes = node.children.s1 ?? []
    const s2Nodes = node.children.s2 ?? []
    const nNodes = node.children.n ?? []
    const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
    const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
    const n = nNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(nNodes[0])) : 0
    const sub1 = s1.substring(0, n)
    const sub2 = s2.substring(0, n)
    if (sub1 < sub2) return { type: 'int', value: -1 }
    if (sub1 > sub2) return { type: 'int', value: 1 }
    return { type: 'int', value: 0 }
  })

  register('cpp_strchr', async () => {
    // Returns pointer — not representable in interpreter
    return { type: 'int', value: 0 }
  })

  register('cpp_strstr', async () => {
    // Returns pointer — not representable in interpreter
    return { type: 'int', value: 0 }
  })

  register('cpp_memset', async () => {})

  register('cpp_memcpy', async () => {})
}
