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
import { PYTHON_BUILTIN_FUNCTIONS, PYTHON_MODULE_METHODS } from '../../../languages/python/builtins'

/**
 * 把簽名上的預設值原文讀成一個值。
 *
 * ⚠️ **只認字面**——數字、字串、True／False／None，
 * 以及 2026-08-23 加的**容器字面**（`[]`／`[1, 2]`／`(25, 10, 5, 1)`／`{}`）。
 * 認不得的（`def f(x=g())`）**丟錯**：靜默當成字串會讓 `def f(n=len(a))`
 * 的 n 變成文字 `"len(a)"`，而那會一路算到下一步去。
 *
 * 🔴 **為什麼容器字面值得特別做**：`def f(xs=[])` 是 Python 最有名的陷阱
 * （那一個串列**在每次呼叫之間共用**），而它在 AI 生的碼裡到處都是。
 * 認不得它等於整段跑不動——**而跑得動才看得到那個陷阱**。
 */
function literalOf(raw: string): RuntimeValue {
  const t = raw.trim()
  if (/^-?\d+$/.test(t)) return { type: 'int', value: Number(t) }
  if (/^-?\d*\.\d+$/.test(t)) return { type: 'double', value: Number(t) }
  if (/^(['"]).*\1$/s.test(t)) return { type: 'string', value: t.slice(1, -1) }
  if (t === 'True' || t === 'False') return { type: 'bool', value: t === 'True' }
  if (t === 'None') return { type: 'void', value: null }
  const container = containerLiteralOf(t)
  if (container) return container
  // 🔴 **訊息要說得出修法**——「只認得字面」讓人知道哪裡錯，
  //    而「改成在函式裡算」才讓人知道**下一步做什麼**。
  throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
    '%1': `預設值 ${t}（只認得字面：數字／文字／True／False／None／[]／()／{}）——` +
      '要算出來的預設值請寫 `=None`，再在函式裡判斷',
  })
}

/** `[…]`／`(…)`／`{…}`（空的）——認不出來回 `null`，交給上面那一層出聲。 */
function containerLiteralOf(t: string): RuntimeValue | null {
  const pairs: [string, string, 'array' | 'tuple' | 'set'][] = [['[', ']', 'array'], ['(', ')', 'tuple'], ['{', '}', 'set']]
  for (const [open, close, kind] of pairs) {
    if (!t.startsWith(open) || !t.endsWith(close)) continue
    const inner = t.slice(1, -1).trim()
    if (inner === '') {
      // ⚠️ `{}` 是**空字典**不是空集合——那是 Python 自己的規則
      if (kind === 'set') return { type: 'object', value: new Map() }
      return { type: 'array', value: [], ...(kind === 'tuple' ? { seqKind: 'tuple' as const } : {}) }
    }
    const parts = splitTopLevel(inner)
    if (!parts) return null
    // 一格認不出來就整顆認不出來——**半個預設值比沒有更糟**
    const items: RuntimeValue[] = []
    for (const part of parts) {
      let v: RuntimeValue
      try { v = literalOf(part) } catch { return null }
      items.push(v)
    }
    return { type: 'array', value: items, ...(kind === 'tuple' ? { seqKind: 'tuple' as const } : kind === 'set' ? { seqKind: 'set' as const } : {}) }
  }
  return null
}

/** 照最外層的逗號切開——括號與引號裡的逗號不算。 */
function splitTopLevel(s: string): string[] | null {
  const out: string[] = []
  let depth = 0, quote = '', cur = ''
  for (const ch of s) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue }
    if (ch === '[' || ch === '(' || ch === '{') depth++
    if (ch === ']' || ch === ')' || ch === '}') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (depth !== 0 || quote) return null
  if (cur.trim() !== '') out.push(cur)
  return out
}

/**
 * 🔴 **預設值只算一次，而算出來的那個東西在每次呼叫之間【共用】。**
 *
 * ```python
 * def collect(item, bucket=[]):
 *     bucket.append(item)
 *     return bucket
 * collect("a")   ['a']
 * collect("b")   ['a', 'b']   ← 不是 ['b']
 * ```
 *
 * 那是 Python 最有名的陷阱之一，而**每次呼叫都給一份新的**會讓這個工具
 * 印出一個真的 Python 不會印的答案——那比不支援更糟。
 *
 * ⚠️ 鍵是**參數物件本身**（不是字串）：兩個不同函式各自的 `xs=[]` 是兩個串列。
 */
const DEFAULT_CACHE = new WeakMap<object, RuntimeValue>()

function defaultValueOf(param: object, raw: string): RuntimeValue {
  const cached = DEFAULT_CACHE.get(param)
  if (cached !== undefined) return cached
  const made = literalOf(raw)
  DEFAULT_CACHE.set(param, made)
  return made
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
        if (dflt !== undefined && dflt !== '') { ctx.scope.declare(fn.params[i].name, defaultValueOf(fn.params[i], dflt)); continue }
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
        // 🔴 **模組的函式也是一個可以被拿在手上的名字**：`from math import sqrt`
        //    之後 `sqrt` 就是這裡的 `math.sqrt`。少了這一格的症狀是
        //    「沒有這個函式 math.sqrt」——而那個名字明明就在表裡。
        const m = PYTHON_MODULE_METHODS[fnv.name]
        if (m) return m(args, self)
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
