/**
 * `python:assert` 的 **execute** 路。
 *
 * 🔴 **不成立時丟出去，而帶著使用者寫的那句話**——與同族的「丟出」同一條規則：
 * 印一個代碼的話，學生看到的是我們的內部詞彙。
 *
 * ⚠️ **沒有訊息時 Python 印的是空的**（`AssertionError` 沒有內文），
 * 所以這裡用條件的原文當說明——那比一個空訊息有用，而它**不是猜**：
 * 那段文字就在使用者的程式裡。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { pythonDisplay } from '../../../languages/python/value-display'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:assert', async (node, ctx) => {
    if (ctx.toBool(await ctx.evaluate(node.children.condition[0]))) return
    const msg = (node.children.value ?? [])[0]
    const text = msg ? pythonDisplay(await ctx.evaluate(msg)) : String(node.metadata?.rawCode ?? 'assert')
    throw new RuntimeError(RUNTIME_ERRORS.USER_RAISED, { '%1': text, '%2': 'AssertionError' })
  })
}
