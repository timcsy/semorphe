/** `cpp:logic` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:logic', async (node, ctx) => {
      const op = String(node.properties.operator)
      const left = await ctx.evaluate(node.children.left[0])

      if (op === '&&') {
        if (!ctx.toBool(left)) return { type: 'bool', value: false }
        const right = await ctx.evaluate(node.children.right[0])
        return { type: 'bool', value: ctx.toBool(right) }
      }
      if (op === '||') {
        if (ctx.toBool(left)) return { type: 'bool', value: true }
        const right = await ctx.evaluate(node.children.right[0])
        return { type: 'bool', value: ctx.toBool(right) }
      }
      return { type: 'bool', value: false }
    })
}
