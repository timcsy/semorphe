/** `cpp:bitwise_not` 的 **execute** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:bitwise_not', async (node, ctx) => {
      const operand = await ctx.evaluate(node.children.operand[0])
      const val = ctx.toNumber(operand)
      return { type: 'int', value: ~Math.trunc(val) }
    })
}
