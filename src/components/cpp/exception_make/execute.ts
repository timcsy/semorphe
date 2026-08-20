/**
 * `cpp:exception_make` 的 **execute** 路——`runtime_error("…")` 之類
 *
 * ## 為什麼是一顆元件，而不是在 `func_call` 裡加特例
 *
 * `throw runtime_error("test error")` 的 `runtime_error(...)` 在 AST 上就是一個
 * 函式呼叫，而**沒有人定義那個函式** → `UNDEFINED_FUNC`
 * （第三十二條護欄 18 段缺口裡的 1 段）。
 *
 * 在 `func_call` 裡認名字會讓核心的呼叫路徑記住一串標準函式庫的名字
 * ——那正是「共用檔認得特定元件的身分」。所以它是一顆元件，自己宣告自己。
 *
 * ## 值的形狀：與 `struct` 實例同一種
 *
 * `{ type: 'object', structName: kind, value: Map{ what: 訊息 } }`
 * ——於是 `e.what()` 走既有的 `struct_at_member`／方法路徑，
 * 而 `catch (runtime_error& e)` 拿到的就是這個物件。
 *
 * ⚠️ **繼承體系不做**：`catch (exception& e)` 接不接得到 `runtime_error`
 * today 由 `try_catch` 決定（它不看型別，一律接住）。那是既有行為，
 * 而它讓這一顆能用；真的要做型別過濾是另一個題目。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:exception_make', async (node, ctx) => {
    const kind = String(node.properties.kind ?? 'runtime_error')
    const msgNode = (node.children.message ?? [])[0]
    const msg = msgNode ? String((await ctx.evaluate(msgNode)).value) : ''
    const fields = new Map<string, RuntimeValue>([['what', { type: 'string', value: msg }]])
    return { type: 'object', value: fields, structName: kind }
  })
}
