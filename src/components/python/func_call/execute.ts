/**
 * `python:func_call` 的 **execute** 路。
 *
 * ⚠️ **比 C++ 那顆短很多，而那是語言的差別不是偷懶**：
 * 沒有命名空間限定名（`Math::square`）、沒有參考參數（`int&`）、
 * 沒有預設引數的型別推導——Python 全部是位置引數傳值。
 *
 * ## 三種呼叫，順序是有理由的
 *
 * ```
 * ① 類別的建構      `Dog("小黑")` —— 函式表裡那一筆的 returnType 是類別名
 * ② 使用者的函式    Python 允許 `def len(x)` 蓋掉內建的，所以它比內建優先
 * ③ 模組的方法      `math.sqrt` —— 整個名字是鍵，因為模組不是變數
 * ④ 內建的自由函式  `len`／`max`／`str`…
 * ```
 *
 * 🔴 **`obj.method()` 不在這裡**——它有自己的元件（接收者是一個**接點**）。
 * 在那顆之前，這裡靠拆名字裡的點來找接收者，而**每一種新的接收者形狀
 * 都變成一道新的字串解析題**（`line.strip()`、`"-"`、`parts[0]` 各一種）。
 *
 * > **一個把運算式壓成字串的欄位，會讓每一種新的運算式都變成一個新的字串解析題。**
 *
 * 🔴 而**綁參數、用預設值、接 `return` 訊號**那一整段住在函式定義那顆的
 * `call.ts`：類別的建構與方法呼叫要一模一樣的規則，而在三處各寫一份的話，
 * 預設值那條只會在其中一處被修好。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { Scope } from '../../../interpreter/scope'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import type { SemanticNode } from '../../../core/types'
import { callWith } from '../func_def/call'
import { PYTHON_BUILTIN_FUNCTIONS, PYTHON_MODULE_METHODS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_call', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    const argValues: RuntimeValue[] = []
    for (const a of node.children.args ?? []) argValues.push(await ctx.evaluate(a))

    const funcDef = ctx.functions.get(name)

    // ① 類別的建構：建一個實例，再跑 `__init__`
    if (funcDef && funcDef.returnType === name && funcDef.body.length === 0) {
      const self: RuntimeValue = { type: 'object', value: new Map() as ObjectFields, structName: name }
      const init = ctx.functions.get(`${name}.__init__`)
      if (init) await callWith(init, [self, ...argValues], ctx, name)
      return self
    }

    // ② 使用者定義的函式
    if (funcDef) return callWith(funcDef, argValues, ctx, name)

    // ③ 模組的方法：`math.sqrt(16)` —— 整個名字就是鍵，因為模組不是變數
    const modFn = PYTHON_MODULE_METHODS[name]
    if (modFn) return modFn(argValues, ctx)

    // ④ 內建的自由函式
    const fn = PYTHON_BUILTIN_FUNCTIONS[name]
    if (fn) return fn(argValues, withCall(ctx))

    // 查不到就出聲——把一個不存在的名字當函式呼叫而靜默回 void，
    // 使用者只會看到一個莫名其妙的結果。
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
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
