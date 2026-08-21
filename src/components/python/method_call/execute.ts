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
import { PYTHON_MODULE_METHODS } from '../../../languages/python/builtins'
import { withCall } from '../func_def/call'
import { callMethod } from './dispatch'

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
        return modFn(modArgs, withCall(ctx))
      }
    }

    const self = await ctx.evaluate(objNode)
    const args: RuntimeValue[] = []
    for (const a of node.children.args ?? []) args.push(await ctx.evaluate(a))

    return callMethod(self, method, args, ctx)
  })
}
