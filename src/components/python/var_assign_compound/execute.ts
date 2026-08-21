/**
 * `python:var_assign_compound` 的 **execute** 路——取值、運算、寫回。
 *
 * 🔴 **運算那一步走同族算術元件的 `apply.ts`**，不自己算：
 * `/=` 是真除法、`%=` 跟著除數的正負號、還有一個 `//=`
 * ——這四條規則這個專案各踩過一次，而**複製一份就是再踩一次的邀請**。
 *
 * ⚠️ 共用的那支複合指派執行器（C++ 在用的那個）**不能重用**：它的 `/=`
 * 是整數除法、`%=` 是 C 的取餘、而且沒有 `//=`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { applyPythonBinary } from '../arithmetic/apply'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign_compound', async (node, ctx) => {
    const name = String(node.properties.name)
    const op = String(node.properties.operator ?? '+=').replace(/=$/, '')
    const current = ctx.scope.get(name)
    const rhs = await ctx.evaluate(node.children.value[0])
    ctx.scope.set(name, applyPythonBinary(op, current, rhs, ctx))
  })
}
