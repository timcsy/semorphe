/**
 * `python:loop_while` 的 **execute** 路。
 *
 * ⚠️ **`break`／`continue` 靠丟訊號**——那不是實作偷懶，是因為
 * 「跳出迴圈」這條邊**語義樹表達不出來**（見 `knowledge/history/118`）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:loop_while', async (node, ctx) => {
    const body = node.children.body ?? []
    const parentScope = ctx.scope
    for (;;) {
      // ⚠️ **Python 的迴圈【沒有】自己的作用域**——迴圈裡指派的名字，
      // 迴圈結束後仍然看得到。C++ 那顆每一輪 `createChild()`，這顆刻意不。
      const condition = await ctx.evaluate(node.children.condition[0])
      if (!ctx.toBool(condition)) break
      try {
        await ctx.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        throw signal
      }
    }
    void parentScope
  })
}
