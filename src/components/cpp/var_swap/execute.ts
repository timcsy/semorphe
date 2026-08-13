/**
 * `cpp:var_swap` 的 **execute** 路
 *
 * 兩個運算元是**位置**（`resolvePlace`），不是名字——所以
 * `swap(a[j], a[j+1])`、`swap(p.x, p.y)` 與 `swap(x, y)` 走同一段。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_swap', async (node, ctx) => {
    const leftNode = (node.children.left ?? [])[0]
    const rightNode = (node.children.right ?? [])[0]
    if (!leftNode || !rightNode) return
    // ⚠️ **兩個位置都先解出來再讀**——先讀一邊再解另一邊的話，
    // `swap(a[i], a[++i])` 這種帶副作用的索引會讓兩次解析看到不同的 i。
    const a = await resolvePlace(leftNode, ctx)
    const b = await resolvePlace(rightNode, ctx)
    const va = a.read()
    const vb = b.read()
    a.write(vb)
    b.write(va)
  })
}
