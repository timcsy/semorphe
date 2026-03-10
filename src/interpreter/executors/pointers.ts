import type { ConceptExecutor } from '../executor-registry'

export function registerPointerExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp_address_of', async (node, ctx) => {
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

  register('cpp_pointer_deref', async (node, ctx) => {
    const ptrNodes = node.children.ptr ?? []
    if (ptrNodes.length > 0) {
      const ptrVal = await ctx.evaluate(ptrNodes[0])
      if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
        const targetName = ptrVal.value
        const targetScope = ctx.pointerTargets.get(targetName)
        if (targetScope) return targetScope.get(targetName)
        return ctx.scope.get(targetName)
      }
    }
    return { type: 'int', value: 0 }
  })

  register('cpp_pointer_assign', async (node, ctx) => {
    const ptrName = String(node.properties.ptr_name)
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
