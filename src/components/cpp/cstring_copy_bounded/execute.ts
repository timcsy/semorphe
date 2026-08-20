/** `cpp:cstring_copy_bounded` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { writableArray, readCString } from '../../../languages/cpp/core/runtime/cstring'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_copy_bounded', async (node, ctx) => {
      const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strncpy 的目標')
      const n = ctx.toNumber(await ctx.evaluate((node.children.n ?? [])[0]))
      const src = readCString(await ctx.evaluate((node.children.src ?? [])[0]))
      // strncpy 的語義：只複製 n 個字元，**不保證結尾有 \0**
      for (let i = 0; i < n && i < dest.length; i++) {
        dest[i] = { type: 'char', value: src[i] ?? '\0' }
      }
    })
}
