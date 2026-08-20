/** `cpp:set_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:set_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      ctx.scope.declare(name, { type: 'array', value: [] })
    })
}
