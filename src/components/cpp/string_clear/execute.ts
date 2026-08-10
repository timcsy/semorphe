/** `cpp:string_clear` 的 **execute** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_clear', async (node, ctx) => {
      const obj = String(node.properties.obj)
      ctx.scope.set(obj, { type: 'string', value: '' })
    })
}
