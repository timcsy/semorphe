/**
 * `cpp:vector_declare` 的 **execute** 路
 *
 * 從 `src/languages/cpp/std/vector/executors.ts` **原封搬過來**——搬移不重寫。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:vector_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    // ⚠️ **初始化列表原本被完全忽略**——`vector<int> v = {3,1,4}` 建出一個
    // 空的向量，於是 `v[1]` 索引越界、`v.size()` 是 0。而**產出的程式碼也
    // 少了那段初始值**，所以來回轉換看起來「成功」了。
    // 初始值是一整個運算式（`vector<int> v = f()`）——求值後直接接管它的內容。
    // 不複製的話，`v` 與 `f()` 回傳的那個陣列會共用同一個物件。
    const source = (node.children.source ?? [])[0]
    if (source) {
      const produced = await ctx.evaluate(source)
      const copied = produced.type === 'array' && Array.isArray(produced.value)
        ? [...produced.value]
        : []
      ctx.scope.declare(name, { type: 'array', value: copied })
      return
    }
    const init = node.children.values ?? []
    const elems = []
    for (const n of init) elems.push(await ctx.evaluate(n))
    ctx.scope.declare(name, { type: 'array', value: elems })
  })
}
