/**
 * `python:func_call` 的 **execute** 路。
 *
 * ⚠️ **比 C++ 那顆短很多，而那是語言的差別不是偷懶**：
 * 沒有命名空間限定名（`Math::square`）、沒有參考參數（`int&`）、
 * 沒有預設引數的型別推導——Python 全部是位置引數傳值。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { ReturnSignal } from '../../../interpreter/executors/functions'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { Scope } from '../../../interpreter/scope'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_call', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    const funcDef = ctx.functions.get(name)
    // 查不到就出聲——把一個不存在的名字當函式呼叫而靜默回 void，
    // 使用者只會看到一個莫名其妙的結果。
    if (!funcDef) throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })

    const args = node.children.args ?? []
    const argValues: RuntimeValue[] = []
    for (const a of args) argValues.push(await ctx.evaluate(a))

    const parentScope = ctx.scope
    ctx.scope = new Scope(parentScope)
    try {
      for (let i = 0; i < funcDef.params.length; i++) {
        // ⚠️ 引數比參數少時**丟錯**，不要補一個預設值——
        // Python 會拋 TypeError，而靜默補值會讓一個真的錯誤看起來像跑成功了。
        if (i >= argValues.length) {
          throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
            '%1': `${name}（少了引數 ${funcDef.params[i].name}）`,
          })
        }
        ctx.scope.declare(funcDef.params[i].name, argValues[i])
      }
      await ctx.executeBody(funcDef.body)
      // 沒有 return 的函式回 None —— 那是 Python 的規則，不是退路。
      return { type: 'void' as const, value: null }
    } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.value
      throw signal
    } finally {
      ctx.scope = parentScope
    }
  })
}
