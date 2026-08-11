/** `cpp:address_of` 的 **execute** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:address_of', async (node, ctx) => {
      const varNodes = node.children.var ?? []
      if (varNodes.length > 0) {
        const varName = String(varNodes[0].properties.name ?? '')
        if (varName) {
          ctx.pointerTargets.set(varName, ctx.scope.findOwner(varName) ?? ctx.scope)
          return { type: 'pointer' as any, value: varName }
        }
      }
      return { type: 'int', value: 0 }
    })
}
