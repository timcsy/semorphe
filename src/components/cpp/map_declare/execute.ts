/** `cpp:map_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:map_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      ctx.scope.declare(name, { type: 'array', value: [] })
    })
}
