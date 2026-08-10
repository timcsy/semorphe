/** `cpp:pointer_assign` 的 **execute** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:pointer_assign', async (node, ctx) => {
      const ptrName = String(node.properties.obj)
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])
      const ptrVal = ctx.scope.get(ptrName)
      if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
        const targetName = ptrVal.value as string
        const targetScope = ctx.pointerTargets.get(targetName)
        if (targetScope) { targetScope.set(targetName, val); return }
        ctx.scope.set(targetName, val)
      }
    })
}
