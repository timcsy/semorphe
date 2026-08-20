/**
 * `cpp:lcd_print` 的 **execute** 路——寫進液晶的**狀態**。
 *
 * 🔴 **不進 `ctx.io`**——那是**程式的輸出**（學生的 `Serial.println` 走同一條），
 * 把液晶的內容寫進去會讓程式的輸出變成錯的。與蜂鳴器同一條判準。
 *
 * ⚠️ **已知後果**：學生按執行，液晶什麼都不會顯示。
 * 那是**視圖層**的缺口（板子視圖，已推遲），**不是用汙染 stdout 去補的**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { lcdOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:lcd_print', async (node, ctx) => {
    const s = lcdOf(ctx, String(node.properties.obj ?? 'lcd'))
    const v = await ctx.evaluate((node.children.value ?? [])[0])
    const text = String((v as { value?: unknown })?.value ?? '')
    const [col, row] = s.cursor
    if (row < s.lines.length) {
      const line = s.lines[row].padEnd(col, ' ')
      s.lines[row] = (line.slice(0, col) + text + line.slice(col + text.length)).slice(0, s.cols)
      s.cursor = [Math.min(col + text.length, s.cols), row]
    }
  })
}
