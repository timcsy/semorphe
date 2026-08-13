/** `cpp:priority_queue_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
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
    register('cpp:priority_queue_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // `priority_queue<int, vector<int>, greater<int>>` —— **第三個樣板引數是比較器**，
      // 而 `greater` 宣告的是**小根堆**（競賽最常見的寫法之一）。
      //
      // ⚠️ 這個資訊必須跟著**值**走：比較器寫在宣告上，而讀它的 `top()`／`pop()`
      // 只拿得到變數名。跟著呼叫端走的話，`top()` 會安靜地回傳最大值
      // ——程式跑完、印出一個數字、而它是錯的。
      const declared = String(node.properties.type ?? 'int')
      const heapOrder = declared.includes('greater') ? ('min' as const) : ('max' as const)
      ctx.scope.declare(name, { type: 'array', value: [], tag: 'priority_queue', heapOrder })
    })
}
