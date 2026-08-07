/**
 * `<queue>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 3 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { defaultValue } from '../../../../interpreter/types'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_queue_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [], tag: 'queue' })
  })

  /**
   * ⚠️ **優先佇列不能抄佇列的執行器。**
   *
   * 兩者都用 `{ type: 'array' }` 存，而 `push` 也真的一樣——**誘惑就在這裡**。
   * 但取出的語義完全不同：
   *
   * | | 取出哪一個 |
   * |---|---|
   * | `queue.front()` | **最先放進去**的 |
   * | `priority_queue.top()` | **最大**的 |
   *
   * `g++ -std=c++17` 對 `pq.push(1); pq.push(5); pq.push(3); cout << pq.top();`
   * 的答案是 **5**。抄 `cpp_queue_front` 會得到 1。
   *
   * 這是 `experience.md`「共用一個實作，可能是『行為一樣』，也可能是
   * 『差別沒被模型化』」的同一個坑——B 項就是靠與 g++ 對答案抓到 `static`
   * 與參照兩個被共用執行器藏住的缺陷。
   *
   * `tag: 'priority_queue'` 讓表示法自己說出它是哪一種，而不是靠呼叫端記得。
   */
  register('cpp_priority_queue_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [], tag: 'priority_queue' })
  })

  register('cpp_priority_queue_top', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    // 最大值——**不是** arr.value[0]
    return arr.value.reduce((max, v) =>
      Number(v.value) > Number(max.value) ? v : max,
    )
  })

  register('cpp_queue_front', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[0]
  })

  register('cpp_queue_back', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[arr.value.length - 1]
  })

  // ─── Map (simulated with array of [key, value] pairs) ───
}
