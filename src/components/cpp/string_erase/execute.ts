/** `cpp:string_erase` 的 **execute** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_erase', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const posNodes = node.children.pos ?? []
      const lenNodes = node.children.len ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : str.length - pos
      ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + str.substring(pos + len) })
    })
}
