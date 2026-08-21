/**
 * `python:func_call` 的 **execute** 路。
 *
 * ⚠️ **比 C++ 那顆短很多，而那是語言的差別不是偷懶**：
 * 沒有命名空間限定名（`Math::square`）、沒有參考參數（`int&`）、
 * 沒有預設引數的型別推導——Python 全部是位置引數傳值。
 *
 * ## 三種呼叫，順序是有理由的（2026-08-21）
 *
 * ```
 * ① 使用者定義的函式    最優先 —— Python 允許 `def len(x)` 蓋掉內建的
 * ②a 模組的方法        `math.sqrt` —— 整個名字是鍵，因為模組不是變數
 * ②b 一般方法          名字裡有點：`nums.append` → 接收者 ＋ 方法名
 * ③ 內建的自由函式      `len`／`max`／`str`…
 * ```
 *
 * 🔴 起因：執行那一軸量到 15 段語料有 12 段跑不動，而其中 **6 段**就是這裡
 * ——那 6 段的 lift 與來回轉換**完全正確**，只是跑不動。
 *
 * > **「畫得出來」與「做得到」是兩件事，而只量投影的護欄分不出來。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { ReturnSignal } from '../../../interpreter/executors/functions'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { Scope } from '../../../interpreter/scope'
import { PYTHON_BUILTIN_FUNCTIONS, PYTHON_BUILTIN_METHODS, PYTHON_MODULE_METHODS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_call', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    const args = node.children.args ?? []
    const argValues: RuntimeValue[] = []
    for (const a of args) argValues.push(await ctx.evaluate(a))

    const funcDef = ctx.functions.get(name)
    if (!funcDef) {
      // ②a 模組的方法：`math.sqrt(16)` —— 整個名字就是鍵，因為模組不是變數。
      const modFn = PYTHON_MODULE_METHODS[name]
      if (modFn) return modFn(argValues, ctx)

      // ②b 方法：名字裡有點。**用最後一個點切**——`obj.attr.method()` 的接收者是 `obj.attr`。
      const dot = name.lastIndexOf('.')
      if (dot > 0) {
        const method = PYTHON_BUILTIN_METHODS[name.slice(dot + 1)]
        if (method) {
          // 🔴 從**作用域裡**拿接收者，不是求值一份拷貝——`append` 要改到原本那個串列。
          const recvName = name.slice(0, dot)
          const self = ctx.scope.get(recvName)
          return method(self, argValues, ctx)
        }
      }
      // ③ 內建的自由函式
      const fn = PYTHON_BUILTIN_FUNCTIONS[name]
      if (fn) return fn(argValues, ctx)
      // 查不到就出聲——把一個不存在的名字當函式呼叫而靜默回 void，
      // 使用者只會看到一個莫名其妙的結果。
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
    }

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
