/** `cpp:string_append` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_append', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return
      const appendVal = await ctx.evaluate(valueNodes[0])
      ctx.scope.set(obj, { type: 'string', value: String(val.value) + String(appendVal.value) })
    })
}
