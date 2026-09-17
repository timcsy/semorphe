/** `cpp:string_append_char` 的 **execute** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_append_char', async (node, ctx) => {
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
      // ⚠️ 辨識器把引數放在 `value`（見 `METHOD_CHILD_SLOT`），而這裡原本只讀
      // `char`——**於是 push_back 完全沒有作用，而且不出聲**。
      //
      // 076 把 `s.push_back(c)` 從通用容器版導到字串專屬版時，沒有人檢查子槽名
      // 對不對。第十條護欄（宣告的子節點名沒有人讀）抓不到這種——它查「有沒有
      // 人讀」，不查「**讀對不對**」。那條邊界寫在它的「不檢測什麼」裡。
      const charNodes = node.slots.value ?? node.slots.char ?? []
      if (charNodes.length === 0) return
      const ch = await ctx.evaluate(charNodes[0])
      // 字元字面可能求值成**數字碼**（`'x'` → 120）。直接串接會把 "ab" 變成
      // "ab120"——與 082 在陣列初始化列表遇到的是同一個病。
      const chStr =
        typeof ch.value === 'number' ? String.fromCharCode(ch.value) : String(ch.value)
      place.write({ type: 'string', value: String(val.value) + chStr })
    })
}
