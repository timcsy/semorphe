/** `cpp:var_ref` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, Callable } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_ref', async (node, ctx) => {
      const name = String(node.properties.name)
      // **一個識別字也可能是函式名**——`sort(v.begin(), v.end(), cmp)` 的 `cmp`。
      //
      // ⚠️ 順序是「先變數後函式」，與 C++ 的名稱查找一致：區域變數遮蔽同名函式。
      // 反過來的話，`int max = 3;` 之後的 `max` 會拿到那個函式。
      try {
        return ctx.scope.get(name)
      } catch (notAVariable) {
        const fn = ctx.functions.get(name)
        if (!fn) throw notAVariable
        // 包成與 lambda 相同的可呼叫值——**不為函式指標發明第二種表示**。
        //
        // ⚠️ `capture: ''`——一個具名函式**看不到呼叫端的區域變數**。
        // `closure` 仍給當下的作用域是因為 `capture: ''` 已經讓
        // `lambdaScope` 建一個空的父層（見 `runtime/lambda.ts`），
        // 所以那個值不會被用來查名字。
        const callable: Callable = {
          params: fn.params,
          body: fn.body,
          capture: '',
          closure: ctx.scope,
        }
        return { type: 'function', value: callable } as RuntimeValue
      }
    })
}
