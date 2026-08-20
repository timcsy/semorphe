/** `cpp:string_substr` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_substr', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const posNodes = node.children.pos ?? []
      const lenNodes = node.children.len ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : str.length - pos
      return { type: 'string', value: str.substring(pos, pos + len) }
    })
}
