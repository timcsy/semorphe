/**
 * `python:set_make` 的 **execute** 路——**去重的串列**。
 *
 * 🔴 值型別與串列同一個（`array`），而 `seqKind: 'set'` 讓它**印出來**是
 * `{1, 2}`。理由與 tuple 那顆一字不差：**一個只在顯示上不同的東西，
 * 不該用型別去表示它**——否則幾十處 `type === 'array'` 的判斷會一處一處
 * 在集合上安靜失效（`in`／`len`／走訪全都是那幾處）。
 *
 * ⚠️ **這個直譯器的集合是有順序的**（寫進去的順序）——真 Python 沒有順序。
 * 那是一個**已知的簡化**：初學課裡看得出差別的地方是 `print(s)` 的排列，
 * 而教學語料一律 `sorted(s)`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { pythonDisplay } from '../../../languages/python/value-display'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:set_make', async (node, ctx) => {
    const seen = new Set<string>()
    const items: RuntimeValue[] = []
    for (const c of node.children.items ?? []) {
      const v = await ctx.evaluate(c)
      const k = pythonDisplay(v)
      if (!seen.has(k)) { seen.add(k); items.push(v) }
    }
    return { type: 'array', value: items, seqKind: 'set' }
  })
}
