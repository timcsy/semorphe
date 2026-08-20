/** `cpp:pointer_declare` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:pointer_declare', async (node, ctx) => {
      const name = String(node.properties.name ?? 'ptr')
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const val = await ctx.evaluate(inits[0])
        ctx.scope.declare(name, val)
      } else {
        ctx.scope.declare(name, { type: 'pointer' as any, value: null })
      }
    })
}
