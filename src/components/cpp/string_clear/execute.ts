/** `cpp:string_clear` 的 **execute** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_clear', async (node, ctx) => {
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
      place.write( { type: 'string', value: '' })
    })
}
