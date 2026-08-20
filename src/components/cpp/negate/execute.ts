/** `cpp:negate` 的 **execute** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:negate', async (node, ctx) => {
      const operand = await ctx.evaluate(node.children.value[0])
      const val = ctx.toNumber(operand)
      return operand.type === 'int'
        ? { type: 'int', value: -Math.trunc(val) }
        : { type: 'double', value: -val }
    })
}
