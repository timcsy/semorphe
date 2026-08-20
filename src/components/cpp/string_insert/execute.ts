/** `cpp:string_insert` 的 **execute** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_insert', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const posNodes = node.children.pos ?? []
      const valueNodes = node.children.value ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const insertStr = valueNodes.length > 0 ? String((await ctx.evaluate(valueNodes[0])).value) : ''
      ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + insertStr + str.substring(pos) })
    })
}
