/**
 * 指標的執行路——語言核心的第五面牆。
 *
 * 指標不屬於任何標準函式庫標頭，所以歸語言核心，與 `core/generators/`、
 * `core/lifters/` 並列。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerPointerExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
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

  register('cpp:pointer_deref', async (node, ctx) => {
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

  register('cpp:pointer_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'ptr')
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = await ctx.evaluate(inits[0])
      ctx.scope.declare(name, val)
    } else {
      ctx.scope.declare(name, { type: 'pointer' as any, value: null })
    }
  })

  register('cpp:new', async (node) => {
    return { type: 'pointer' as any, value: `heap_${node.properties.type ?? 'int'}` }
  })



  register('cpp:malloc', async (node) => {
    // ⚠️ 退路是 `int*` 不是 `int`——`type` 在這顆元件裡是**轉型型別**（指標），
    // 產生器寫的是 `(${type})malloc(…)`。兩邊曾經不一致，而積木下拉當時給的
    // 是元素型別，於是使用者選 `int` 會產出 `(int)malloc(…)`，不合法的 C++。
    return { type: 'pointer' as any, value: `heap_${node.properties.type ?? 'int*'}` }
  })

  register('cpp:free', async () => {})

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
