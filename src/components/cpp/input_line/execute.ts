/** `cpp:input_line` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:input_line', async (node, ctx) => {
      const name = String(node.properties.name)
      const line = ctx.io.read()
      try {
        ctx.scope.set(name, { type: 'string', value: line ?? '' })
      } catch {
        ctx.scope.declare(name, { type: 'string', value: line ?? '' })
      }
    })
}
