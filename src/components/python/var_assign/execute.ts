/**
 * `python:var_assign` 的 **execute** 路。
 *
 * ## 🔴 `self.name = name` 也走這裡（2026-08-21）
 *
 * lift 那一側把左邊整段當成名字（`extract: "text"`），所以 `self.name`
 * 是一個**名字裡有點的變數**。指派時要分辨：有點就是寫進那個物件的欄位。
 *
 * 不分辨的話會建立一個名字叫 `self.name` 的**區域變數**，
 * 而 `d.bark()` 讀 `self.name` 時說「這個鍵不在」
 * ——**寫進去與讀出來走了兩條不同的路，而兩邊各自看起來都對**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'x')
    const v = await ctx.evaluate(node.children.value[0])

    // `self.name = …` —— 寫進那個物件的欄位
    const dot = name.lastIndexOf('.')
    if (dot > 0) {
      const recvName = name.slice(0, dot)
      if (ctx.scope.has(recvName)) {
        const recv = ctx.scope.get(recvName)
        if (recv.type === 'object') {
          ;(recv.value as ObjectFields).set(name.slice(dot + 1), v)
          return
        }
      }
      // ⚠️ 左邊有點而接收者不是物件 → **出聲**。建一個名字裡有點的變數
      //    會讓之後的讀取走另一條路而找不到它。
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${recvName} 不是一個可以存欄位的東西` })
    }
    // 🔴 **Python 沒有「宣告」這件事**：第一次指派建立它，之後覆寫。
    // ⚠️ 所以【不能】每次都 `declare`——那在迴圈第二圈會 `DUPLICATE_DECLARATION`。
    if (ctx.scope.has(name)) ctx.scope.set(name, v)
    else ctx.scope.declare(name, v)
  })
}
