/**
 * `python:string_make` 的 **execute** 路——把片段接起來。
 *
 * ⚠️ **不能用 `+` 的語義**：Python 的 f-string 對每一格做的是 `format()`，
 * 而 `format()` 對數字與字串的輸出不同（`str(3.0)` 是 `3.0`）。
 * 那件事由插槽那顆負責，這裡只負責串接。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_make', async (node, ctx) => {
    let out = ''
    for (const p of node.children.parts ?? []) out += String((await ctx.evaluate(p)).value)
    return { type: 'string', value: out }
  })
}
