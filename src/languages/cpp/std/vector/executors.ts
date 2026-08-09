/**
 * `<vector>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 4 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { defaultValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

export function registerExecutors(
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

  register('cpp:vector_size', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'int', value: 0 }
    }
    return { type: 'int', value: arr.value.length }
  })

  register('cpp:vector_pop', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (arr.value.length > 0) {
      arr.value.pop()
    }
  })

  register('cpp:vector_back', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[arr.value.length - 1]
  })

  // ─── Stack (simulated with array: push=push, pop=pop, top=last) ───
}
