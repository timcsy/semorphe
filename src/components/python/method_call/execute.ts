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
import { Scope } from '../../../interpreter/scope'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import type { SemanticNode } from '../../../core/types'
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
    if (builtin) return builtin(self, args, withCall(ctx))

    // 查不到就出聲——靜默回 None 會讓錯誤帶到下一步去算。
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `.${method}()` })
  })
}

/**
 * 把「怎麼呼叫一個 lambda」交給內建表。
 *
 * 🔴 排序的 `key=` 需要它（`xs.sort(key=lambda x: x[1])`），而內建表**不認得
 * 直譯器**——它只拿得到一個很窄的介面。少了這一格的症狀是 `key=` 被**靜靜忽略**：
 * 排序仍然發生、仍然有輸出，而**順序是錯的**。
 *
 * > **一個被忽略的參數不會讓程式停下來，它只會讓答案不一樣。**
 */
function withCall(ctx: Parameters<ComponentExecutor>[1]): Parameters<ComponentExecutor>[1] & {
  call: (fn: RuntimeValue, args: RuntimeValue[]) => Promise<RuntimeValue>
} {
  return Object.assign(Object.create(Object.getPrototypeOf(ctx) as object), ctx, {
    call: async (fn: RuntimeValue, args: RuntimeValue[]): Promise<RuntimeValue> => {
      if (fn.type !== 'function') {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個東西叫不動' })
      }
      // ⚠️ 匿名函式的本體是一個**運算式**——`callWith` 走的是語句 ＋ `return` 訊號，
      //    所以這裡自己綁參數再求值那個運算式。
      const fnv = fn.value as { params: { name: string }[]; body: SemanticNode[] }
      const parent = ctx.scope
      ctx.scope = new Scope(parent)
      try {
        fnv.params.forEach((prm, i) => ctx.scope.declare(prm.name, args[i] ?? { type: 'void', value: null }))
        return await ctx.evaluate(fnv.body[0])
      } finally {
        ctx.scope = parent
      }
    },
  })
}
