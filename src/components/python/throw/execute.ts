/**
 * `python:throw` 的 **execute** 路。
 *
 * 🔴 **丟出去的東西要帶著【使用者寫的那句話】**：`except ... as e` 之後
 * `print(e)` 印的是那句話，不是類別名。少了它的話學生看到的是一個代碼。
 *
 * ⚠️ 例外的**型別今天不參與比對**——同族的「嘗試」那顆的檔頭寫著理由
 * （這個直譯器沒有例外的類別階層，第一個分支永遠接住）。型別仍然存進
 * 訊息參數裡，所以它在錯誤訊息上看得見。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { pythonDisplay } from '../../../languages/python/value-display'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:throw', async (node, ctx) => {
    const name = String(node.properties.exception ?? 'ValueError')
    const v = (node.children.value ?? [])[0]
    const msg = v ? pythonDisplay(await ctx.evaluate(v)) : name
    throw new RuntimeError(RUNTIME_ERRORS.USER_RAISED, { '%1': msg, '%2': name })
  })
}
