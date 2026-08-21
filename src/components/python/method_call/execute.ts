/**
 * `python:method_call` 的 **execute** 路。
 *
 * 🔴 **接收者是求值出來的，不是從字串拆的**——那是這顆元件存在的全部理由。
 *
 * ⚠️ 而**求值必須拿到同一個物件**（不是拷貝）：`nums.append(9)` 要改到原本
 * 那個串列。變數引用回傳的就是作用域裡那一份，所以這件事是免費的
 * ——而它免費**是因為值型別用了參照語義**，不是因為沒人想過。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { PYTHON_BUILTIN_METHODS, PYTHON_MODULE_METHODS } from '../../../languages/python/builtins'
import { callWith } from '../func_def/call'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:method_call', async (node, ctx) => {
    const method = String(node.properties.method ?? '')

    // 🔴 **模組不是變數**：`math.sqrt(16)` 的接收者 `math` 在作用域裡不存在，
    //    求值它會說「沒有這個變數」。模組的方法用整個名字當鍵。
    const objNode = node.children.obj[0]
    const objName = String(objNode.properties?.name ?? '')
    if (objName && !ctx.scope.has(objName)) {
      const modFn = PYTHON_MODULE_METHODS[`${objName}.${method}`]
      if (modFn) {
        const modArgs: RuntimeValue[] = []
        for (const a of node.children.args ?? []) modArgs.push(await ctx.evaluate(a))
        return modFn(modArgs, ctx)
      }
    }

    const self = await ctx.evaluate(objNode)
    const args: RuntimeValue[] = []
    for (const a of node.children.args ?? []) args.push(await ctx.evaluate(a))

    // 使用者定義的類別的方法：`d.bark()` —— 登記成 `類別.方法`
    if (self.type === 'object' && self.structName) {
      const m = ctx.functions.get(`${self.structName}.${method}`)
      if (m) return callWith(m, [self, ...args], ctx, method)
    }

    const builtin = PYTHON_BUILTIN_METHODS[method]
    if (builtin) return builtin(self, args, ctx)

    // 查不到就出聲——靜默回 None 會讓錯誤帶到下一步去算。
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `.${method}()` })
  })
}
