/** `cpp:var_declare_auto` 的 **execute** 路——從共用檔原封剪過來（批次第二十批：建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_declare_auto', async (node, ctx) => {
      const name = String(node.properties.name)
      const init = node.children.initializer
      if (init && init.length > 0) {
        const val = await ctx.evaluate(init[0])
        ctx.scope.declare(name, val)
      } else {
        ctx.scope.declare(name, { type: 'int', value: 0 })
      }
    })
}
