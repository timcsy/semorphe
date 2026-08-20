/** `cpp:print` 的 **execute** 路——從共用檔原封剪過來（批次第三十九批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { valueToString } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:print', async (node, ctx) => {
      const values = node.children.values ?? []
      for (const valNode of values) {
        const val = await ctx.evaluate(valNode)
        if (val.type === 'string' && val.value === '\n') {
          ctx.io.writeNewline()
        } else {
          ctx.io.write(valueToString(val))
        }
      }
    })
}
