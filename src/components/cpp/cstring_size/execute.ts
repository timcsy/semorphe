/** `cpp:cstring_size` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_size', async (node, ctx) => {
      const strNodes = node.children.str ?? []
      if (strNodes.length === 0) return { type: 'int', value: 0 }
      const val = await ctx.evaluate(strNodes[0])
      return { type: 'int', value: String(val.value).length }
    })
}
