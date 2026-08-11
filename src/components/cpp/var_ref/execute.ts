/** `cpp:var_ref` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_ref', async (node, ctx) => {
      const name = String(node.properties.name)
      return ctx.scope.get(name)
    })
}
