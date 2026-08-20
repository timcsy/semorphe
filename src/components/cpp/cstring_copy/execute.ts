/** `cpp:cstring_copy` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { writableArray, readCString, writeCString } from '../../../languages/cpp/core/runtime/cstring'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_copy', async (node, ctx) => {
      const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strcpy 的目標')
      writeCString(dest, readCString(await ctx.evaluate((node.children.src ?? [])[0])))
    })
}
