/**
 * `python:bitwise_not` 的 **execute** 路——`~x` 就是 `-x - 1`。
 *
 * 🔴 **不做位寬遮罩**：Python 的整數沒有位數上限，`~5` 是 `-6`
 * ——而 32 位元的遮罩會在大數上給出一個真的 Python 不會給的答案。
 *
 * ⚠️ 不是整數就**出聲**（`~1.5` 在 Python 是 TypeError）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:bitwise_not', async (node, ctx) => {
    const v = await ctx.evaluate(node.children.operand[0])
    if (v.type !== 'int' && v.type !== 'bool') {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': '~ 只能用在整數上' })
    }
    return { type: 'int', value: -Number(v.value) - 1 }
  })
}
