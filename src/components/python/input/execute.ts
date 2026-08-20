/** `python:input` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:input', async (node, ctx) => {
    const p = (node.children.prompt ?? [])[0]
    if (p) ctx.io.write(String((await ctx.evaluate(p)).value))
    // Python 的 input() 【永遠】回字串 —— 這是初學者最常撞的一格。
    // ⚠️ **沒有輸入時丟錯，不要回空字串**：Python 會拋 EOFError，
    // 而靜默回 `''` 會讓「使用者沒打字」與「使用者打了空行」變成同一件事。
    const line = ctx.io.read()
    if (line === null) {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': '沒有更多輸入了' })
    }
    return { type: 'string' as const, value: line }
  })
}
