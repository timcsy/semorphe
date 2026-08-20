/** `cpp:math_abs` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:math_abs', async (node, ctx) => {
      const v = node.children.value?.[0]
      if (!v) return { type: 'int' as const, value: 0 }
      const val = await ctx.evaluate(v)
      return { type: val.type, value: Math.abs(ctx.toNumber(val)) }
    })
}
