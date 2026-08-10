/** `cpp:string_empty` 的 **execute** 路——從 `std/string/executors.ts` 原封搬過來。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, e: ConceptExecutor) => void): void {
  register('cpp:string_empty', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    return { type: 'bool', value: String(val.value).length === 0 }
  })
}
