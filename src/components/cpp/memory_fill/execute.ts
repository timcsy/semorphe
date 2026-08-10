/** `cpp:memory_fill` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { writableArray } from '../../../languages/cpp/std/cstring/executors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:memory_fill', async (node, ctx) => {
      const arr = writableArray(ctx as never, (node.children.ptr ?? [])[0], 'memset 的目標')
      const v = await ctx.evaluate((node.children.value ?? [])[0])
      const size = ctx.toNumber(await ctx.evaluate((node.children.size ?? [])[0]))
      // 目標是字元陣列時要存**字元**——`'a'` 求值成數字 97，直接塞進去會讓
      // `cout << s` 印出 `979797`。
      const asChar = arr.length > 0 && arr[0]?.type === 'char'
      const fill: RuntimeValue = asChar
        ? { type: 'char', value: typeof v.value === 'number' ? String.fromCharCode(v.value) : String(v.value) }
        : { ...v }
      for (let i = 0; i < size && i < arr.length; i++) arr[i] = { ...fill }
    })
}
