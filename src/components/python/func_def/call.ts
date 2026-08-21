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
import type { RuntimeValue } from '../../../interpreter/types'
import type { SemanticNode } from '../../../core/types'
import { Scope } from '../../../interpreter/scope'
import { ReturnSignal } from '../../../interpreter/executors/functions'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

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
  fn: { params: { name: string; type: string; default?: string }[]; body: SemanticNode[] },
  args: RuntimeValue[],
  ctx: Parameters<ComponentExecutor>[1],
  label: string,
): Promise<RuntimeValue> {
  const parent = ctx.scope
  ctx.scope = new Scope(parent)
  try {
    for (let i = 0; i < fn.params.length; i++) {
      if (i >= args.length) {
        const dflt = fn.params[i].default
        if (dflt !== undefined && dflt !== '') { ctx.scope.declare(fn.params[i].name, literalOf(dflt)); continue }
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
          '%1': `${label}（少了引數 ${fn.params[i].name}）`,
        })
      }
      ctx.scope.declare(fn.params[i].name, args[i])
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

