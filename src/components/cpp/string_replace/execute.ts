/** `cpp:string_replace` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_replace', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const posNodes = node.children.pos ?? []
      const lenNodes = node.children.len ?? []
      const valueNodes = node.children.value ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : 0
      const replaceStr = valueNodes.length > 0 ? String((await ctx.evaluate(valueNodes[0])).value) : ''
      ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + replaceStr + str.substring(pos + len) })
    })
}
