/** `cpp:print_formatted` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { formatPrintf } from '../../../languages/cpp/std/cstdio/executors'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:print_formatted', async (node, ctx) => {
      const format = String(node.properties.format ?? '')
      const argNodes = node.children.args ?? []
      const argValues: RuntimeValue[] = []
      for (const argNode of argNodes) {
        argValues.push(await ctx.evaluate(argNode))
      }
      const output = formatPrintf(format, argValues)
      ctx.io.write(output)
    })
}
