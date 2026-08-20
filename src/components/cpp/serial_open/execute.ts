/**
 * `cpp:serial_open` 的 **execute** 路。
 *
 * ⚠️ **模擬器裡它幾乎什麼都不做**——傳輸速率在模擬中沒有意義。
 * 🔴 **而它不是 `skipPaths`**：`Serial.begin` 是**可執行的**（真板子上它有作用），
 * 只是這個模擬器不需要那個作用。**「宣告性的空」與「模擬不需要」是兩件事。**
 *
 * 它記下「序列埠開過了」，讓未來的診斷說得出
 * 「你沒有 `Serial.begin` 就輸出，真板子上會看不到東西」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { markSerialOpen } from '../../../languages/cpp/core/runtime/arduino-serial'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:serial_open', async (node, ctx) => {
    await ctx.evaluate((node.children.baud ?? [])[0])   // 引數仍要求值——它可能有副作用
    markSerialOpen(ctx)
  })
}
