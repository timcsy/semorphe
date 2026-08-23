/** `cpp:func_def` 的 **execute** 路——從共用檔原封剪過來（批次第四十二批：樹根與進入點）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:func_def', async (node, ctx) => {
      const name = String(node.properties.name)
      const returnType = String(node.properties.return_type || 'void')
      const paramChildren = node.children.params ?? []
      // 🔴 **預設值要一起帶過去**（2026-08-23）：呼叫那側少給引數時要用它，
      //    而它在這裡被丟掉的症狀是 `add(1)` 在 `int add(int a, int b = 10)`
      //    底下算出 1 而不是 11——**不報錯、有輸出、而答案錯**。
      //    ⚠️ 同族的 Python 那顆**兩天前就修過同一個洞**，而它的註解逐字寫著
      //    「看起來像 lift 沒認出預設值，其實是登記時掉的」。
      //    > **同一個洞在第二個語言上不會自己好。**
      const params = paramChildren.map(p => ({
        type: String(p.properties.type ?? 'int'),
        name: String(p.properties.name ?? ''),
        default: p.properties.default === undefined ? undefined : String(p.properties.default),
      }))
      ctx.functions.set(name, {
        name,
        params,
        returnType,
        body: node.children.body ?? [],
      })
    })
}
