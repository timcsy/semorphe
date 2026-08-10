/** `cpp:cstring_append` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { writableArray, readCString, writeCString } from '../../../languages/cpp/std/cstring/executors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:cstring_append', async (node, ctx) => {
      const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strcat 的目標')
      const cur = readCString({ type: 'array', value: dest } as RuntimeValue)
      writeCString(dest, cur + readCString(await ctx.evaluate((node.children.src ?? [])[0])))
    })
}
