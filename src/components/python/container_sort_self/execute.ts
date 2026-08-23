/**
 * `python:container_sort_self` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算，也不自己挑**：先問使用者定義的類別方法，再回內建表。
 * `key=` 怎麼呼叫、`reverse=` 怎麼影響次序已經寫在
 * `languages/python/builtins.ts`，而使用者手寫的 `.sort(...)` 走的也是那一份。
 *
 * ⚠️ **它就地改那一串，回的是 `None`**——那正是它與同族「排一份新的」的差別。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
// 🔴 **使用者自己的類別可能也有這個方法**（`c.add(3)`）——`callMethod` 先問
//    使用者定義的，再回內建表。少了這一步的症狀是一個完全正確的 Python 程式
//    在執行期收到「串列沒有 add」這種與它無關的錯誤。
import { callMethod } from '../method_call/dispatch'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_sort_self', async (node, ctx) => {
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = []
    // 關鍵字引數包成內建表看得懂的形狀（`__kw__名字` ＋ 值）
    for (const slot of ['key', 'reverse'] as const) {
      const v = (node.children[slot] ?? [])[0]
      if (!v) continue
      args.push({ type: 'array', value: [{ type: 'string', value: `__kw__${slot}` }, await ctx.evaluate(v)] })
    }
    return callMethod(self, 'sort', args, ctx)
  })
}
