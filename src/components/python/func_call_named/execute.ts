/**
 * `python:func_call_named` 的 **execute** 路——求出那個值，**並帶著名字**。
 *
 * 🔴 這個直譯器的引數是一串位置值，沒有地方放名字。所以這裡回一個
 * 兩格的陣列（名字、值），而**認得它的是呼叫端**（今天只有排序的 `key=`）。
 *
 * ⚠️ 那是一個**已知的簡化**：呼叫端不認得的關鍵字引數會被當成一個位置引數，
 * 而它長得像一個兩格的串列。寫在這裡，不是靜靜地做。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_call_named', async (node, ctx) => ({
    type: 'array',
    value: [
      { type: 'string' as const, value: `__kw__${String(node.properties.name ?? '')}` },
      await ctx.evaluate(node.children.value[0]),
    ],
  }))
}
