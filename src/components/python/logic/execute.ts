/** `python:logic` 的 **execute** 路——**短路求值**。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:logic', async (node, ctx) => {
    const op = String(node.properties.operator ?? 'and')
    const l = await ctx.evaluate(node.children.left[0])
    // 短路：`and` 左邊為假、`or` 左邊為真時，右邊【不求值】。
    // 這不是最佳化，是語義 —— 右邊可能有副作用或會出錯。
    if (op === 'and' && !ctx.toBool(l)) return l
    if (op === 'or' && ctx.toBool(l)) return l
    if (op !== 'and' && op !== 'or') {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
    }
    // Python 回傳的是【運算元本身】而不是布林 —— `0 or 'x'` 是 `'x'`。
    return await ctx.evaluate(node.children.right[0])
  })
}
