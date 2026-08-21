/**
 * **用一組已經求好的值呼叫一個已登記的函式。**
 *
 * 住在函式定義那顆的資料夾裡，因為「一個函式怎麼被呼叫」是它的規範
 * ——參數綁定、預設值、`return` 訊號。
 *
 * 🔴 **三個呼叫端要它**：一般呼叫、類別的建構、方法呼叫。
 * 在三處各寫一份的話，預設值那條規則只會在其中一處被修好。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, FuncRef } from '../../../interpreter/types'
import type { SemanticNode } from '../../../core/types'
import { Scope } from '../../../interpreter/scope'
import { ReturnSignal } from '../../../interpreter/executors/functions'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'

/**
 * 把簽名上的預設值原文讀成一個值。
 *
 * ⚠️ **只認字面**——數字、字串、True／False／None。
 * 認不得的（`def f(x=[])`／`def f(x=g())`）**丟錯**：
 * 靜默當成字串會讓 `def f(n=len(a))` 的 n 變成文字 `"len(a)"`，
 * 而那會一路算到下一步去。
 */
function literalOf(raw: string): RuntimeValue {
  const t = raw.trim()
  if (/^-?\d+$/.test(t)) return { type: 'int', value: Number(t) }
  if (/^-?\d*\.\d+$/.test(t)) return { type: 'double', value: Number(t) }
  if (/^(['"]).*\1$/s.test(t)) return { type: 'string', value: t.slice(1, -1) }
  if (t === 'True' || t === 'False') return { type: 'bool', value: t === 'True' }
  if (t === 'None') return { type: 'void', value: null }
  throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `預設值 ${t}（只認得字面）` })
}

/**
 * 用一組已經求好的值呼叫一個函式。
 *
 * 抽出來是因為**三個呼叫端要它**：一般函式、類別的建構、方法呼叫
 * ——而參數綁定與 `return` 訊號的處理**在三處各寫一份就會漂**。
 */
export async function callWith(
  fn: { params: { name: string; type: string; default?: string; variadic?: string }[]; body: SemanticNode[] },
  args: RuntimeValue[],
  ctx: Parameters<ComponentExecutor>[1],
  label: string,
): Promise<RuntimeValue> {
  // 🔴 **具名引數先拆出來**（`area(h=2, w=5)`）：它們被包成 `['__kw__名字', 值]`
  //    混在位置引數裡，不拆的話 `h` 會拿到那個**包裹本身**
  //    ——症狀是「串列不能做 *」，而使用者寫的是完全正確的 Python。
  const named = new Map<string, RuntimeValue>()
  const positional: RuntimeValue[] = []
  for (const a of args) {
    const kw = a?.type === 'array' ? (a.value as RuntimeValue[]) : null
    const tag = kw && kw.length === 2 ? String(kw[0]?.value ?? '') : ''
    if (tag.startsWith('__kw__')) named.set(tag.slice(6), kw![1])
    else positional.push(a)
  }

  const parent = ctx.scope
  ctx.scope = new Scope(parent)
  try {
    for (let i = 0; i < fn.params.length; i++) {
      // 🔴 `*args`：**把剩下的位置引數收成一個 tuple**，而它一定是最後一個參數
      if (fn.params[i].variadic === 'list') {
        ctx.scope.declare(fn.params[i].name, {
          type: 'array', value: positional.slice(i), seqKind: 'tuple',
        })
        break
      }
      const byName = named.get(fn.params[i].name)
      if (byName !== undefined) { ctx.scope.declare(fn.params[i].name, byName); continue }
      if (i >= positional.length) {
        const dflt = fn.params[i].default
        if (dflt !== undefined && dflt !== '') { ctx.scope.declare(fn.params[i].name, literalOf(dflt)); continue }
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
          '%1': `${label}（少了引數 ${fn.params[i].name}）`,
        })
      }
      ctx.scope.declare(fn.params[i].name, positional[i])
    }
    await ctx.executeBody(fn.body)
    return { type: 'void', value: null }
  } catch (signal) {
    if (signal instanceof ReturnSignal) return signal.value as RuntimeValue
    throw signal
  } finally {
    ctx.scope = parent
  }
}


/**
 * **一個函式被當成值傳出去時長什麼樣**——`sorted(w, key=len)` 的那個 `len`。
 *
 * 🔴 裸名 `len` 在作用域裡查不到（它不是變數），而 Python 的函式**是值**。
 * 少了這個的症狀是 `RUNTIME_ERR_UNDECLARED_VAR: len`——一個看起來像
 * 「你打錯字了」的錯誤訊息，而使用者寫的是完全正確的 Python。
 *
 * ⚠️ 存的是**名字不是實作**：使用者可以 `def len(x)` 蓋掉內建的，
 * 而查表的順序（使用者優先）只該有一份，住在呼叫的時候。
 */
export type { FuncRef } from '../../../interpreter/types'

/** 這個名字是不是一個「叫得動的東西」——查不到回 `null`。 */
export function funcValueOf(name: string, ctx: Parameters<ComponentExecutor>[1]): RuntimeValue | null {
  if (ctx.functions.has(name)) return { type: 'function', value: { ref: 'user', name } as FuncRef }
  if (PYTHON_BUILTIN_FUNCTIONS[name]) return { type: 'function', value: { ref: 'builtin', name } as FuncRef }
  return null
}

/**
 * 把「怎麼呼叫一個拿在手上的函式值」交給內建表。
 *
 * 🔴 排序的 `key=` 需要它（`xs.sort(key=lambda x: x[1])`），而內建表**不認得
 * 直譯器**——它只拿得到一個很窄的介面。少了這一格的症狀是 `key=` 被**靜靜忽略**：
 * 排序仍然發生、仍然有輸出，而**順序是錯的**。
 *
 * > **一個被忽略的參數不會讓程式停下來，它只會讓答案不一樣。**
 *
 * ⚠️ 這份**曾經有兩份**（`func_call` 與 `method_call` 各一份，一字不差）
 * ——而「函式當值傳」這條新規則只會被加進其中一份。
 */
export function withCall(ctx: Parameters<ComponentExecutor>[1]): Parameters<ComponentExecutor>[1] & {
  call: (fn: RuntimeValue, args: RuntimeValue[]) => Promise<RuntimeValue>
} {
  const self = Object.assign(Object.create(Object.getPrototypeOf(ctx) as object) as object, ctx, {
    call: async (fn: RuntimeValue, args: RuntimeValue[]): Promise<RuntimeValue> => {
      if (fn.type !== 'function') {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個東西叫不動' })
      }
      const fnv = fn.value as FuncRef | { params: { name: string }[]; body: SemanticNode[] }

      // 具名的函式：**使用者的優先**——Python 允許 `def len(x)` 蓋掉內建的
      if ('ref' in fnv) {
        const def = ctx.functions.get(fnv.name)
        if (def) return callWith(def, args, ctx, fnv.name)
        const b = PYTHON_BUILTIN_FUNCTIONS[fnv.name]
        if (b) return b(args, self)
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': fnv.name })
      }

      // ⚠️ 匿名函式的本體是一個**運算式**——`callWith` 走的是語句 ＋ `return` 訊號，
      //    所以這裡自己綁參數再求值那個運算式。
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
  return self as Parameters<ComponentExecutor>[1] & {
    call: (fn: RuntimeValue, args: RuntimeValue[]) => Promise<RuntimeValue>
  }
}
