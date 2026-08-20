/** `cpp:memory_copy` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { writableArray } from '../../../languages/cpp/core/runtime/cstring'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:memory_copy', async (node, ctx) => {
      const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'memcpy 的目標')
      const srcNode = (node.children.src ?? [])[0]
      const src = writableArray(ctx as never, srcNode, 'memcpy 的來源')
      const size = ctx.toNumber(await ctx.evaluate((node.children.size ?? [])[0]))
      for (let i = 0; i < size && i < dest.length && i < src.length; i++) dest[i] = { ...src[i] }
    })
}
