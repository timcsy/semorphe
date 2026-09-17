/** `cpp:string_replace` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_replace', async (node, ctx) => {
      /**
       * 🔴 **接收者是一個【位置】，不是一個名字**（2026-09-18）。
       *
       * 這幾顆會**改到接收者本身**（字串在這個執行期是不可變的值，所以要寫回）。
       * 名字寫回只對「接收者是一個裸的變數」成立——而 `parts[i].append(c)`
       * 的接收者是一格陣列。左值機制（`resolvePlace`）本來就在，
       * 而 `a[i]`／`o.x`／`*p` 都已經宣告過自己怎麼被寫回。
       *
       * > **能讀又能寫的東西叫位置，而位置早就有一套機制——
       * > 用名字寫回等於在它旁邊再開一條只走得了一種形狀的路。**
       */
      const place = await resolvePlace((node.slots.obj ?? [])[0], ctx)
      const val = place.read()
      const str = String(val.value)
      const posNodes = node.slots.pos ?? []
      const lenNodes = node.slots.len ?? []
      const valueNodes = node.slots.value ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : 0
      const replaceStr = valueNodes.length > 0 ? String((await ctx.evaluate(valueNodes[0])).value) : ''
      place.write({ type: 'string', value: str.substring(0, pos) + replaceStr + str.substring(pos + len) })
    })
}
