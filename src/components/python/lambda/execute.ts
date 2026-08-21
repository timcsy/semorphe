/**
 * `python:lambda` 的 **execute** 路——回傳一個可以晚點再呼叫的東西。
 *
 * ⚠️ **本體是運算式，所以回傳值就是它算出來的**——不需要 `return`。
 * 🔴 而它看得到定義當下的作用域（Python 的匿名函式一律如此），
 * 所以 `closure` 帶著現在這個作用域走。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:lambda', async (node, ctx) => ({
    type: 'function',
    value: {
      params: (node.children.params ?? []).map((p) => ({ name: String(p.properties.name ?? ''), type: '' })),
      body: node.children.body ?? [],
      capture: '&' as const,
      closure: ctx.scope,
    },
  }))
}
