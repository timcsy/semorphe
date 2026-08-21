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
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { callWith, withCall } from '../func_def/call'
import { callMethod } from './dispatch'
import { isNamedCall } from '../../../core/component/traits'

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

    // 🔴 **`super().__init__(…)`**：接收者是一個對 `super` 的呼叫，而它在
    //    作用域裡不存在。它的意思是「同一個 self，而方法從**上一層**開始找」。
    //
    // ⚠️ **上一層是誰記在函式表裡**（`類別.__base__`，見類別定義那顆）——
    //    而「哪一個類別」由 `self` 自己帶著（`structName`）。
    //    少了這一段的症狀是「沒有這個函式 super」，而使用者寫的是
    //    Python 裡最標準的建構式串接。
    // ⚠️ **問性狀不看身分**——`isNamedCall` 是同族那顆自己宣告的，
    //    而拿身分比對的話那顆改名時不會有人發現。
    if (isNamedCall(objNode.componentId) && String(objNode.properties?.name ?? '') === 'super') {
      const self = ctx.scope.has('self') ? ctx.scope.get('self') : null
      if (!self || self.type !== 'object' || !self.structName) {
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': 'super()（不在方法裡）' })
      }
      const base = ctx.functions.get(`${self.structName}.__base__`)?.name
      const fn = base ? ctx.functions.get(`${base}.${method}`) : undefined
      if (!fn) {
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `super().${method}()` })
      }
      const superArgs: RuntimeValue[] = []
      for (const a of node.children.args ?? []) superArgs.push(await ctx.evaluate(a))
      return callWith(fn, [self, ...superArgs], ctx, `super().${method}`)
    }

    const self = await ctx.evaluate(objNode)
    const args: RuntimeValue[] = []
    for (const a of node.children.args ?? []) args.push(await ctx.evaluate(a))

    return callMethod(self, method, args, ctx)
  })
}
