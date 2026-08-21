/** `python:func_def` 的 **execute** 路——登記，不執行。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_def', async (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    // 型別留空 —— Python 沒有參數型別，而這個欄位是共用結構要的。
    // 🔴 **預設值要一起帶過去**（2026-08-21）：呼叫那側少給引數時要用它，
    //    而它在這裡被丟掉的症狀是「`greet("小明")` 說少了引數 greeting」
    //    ——**看起來像 lift 沒認出預設值，其實是登記時掉的**。
    const params = (node.children.params ?? [])
      .map((p) => ({
        name: String(p.properties.name ?? ''),
        type: '',
        default: p.properties.default === undefined ? undefined : String(p.properties.default),
        // 🔴 **`*args` 的標記也要一起帶過去**——與預設值同一個理由：
        //    在這裡掉的話症狀是「呼叫時說少了引數」，看起來像 lift 沒認出來。
        variadic: p.properties.variadic === undefined ? undefined : String(p.properties.variadic),
      }))
      .filter((p) => p.name)
    ctx.functions.set(name, { name, params, body: node.children.body ?? [], returnType: '' })
  })
}
