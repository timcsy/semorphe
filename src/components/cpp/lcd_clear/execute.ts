/** `cpp:lcd_clear` 的 **execute** 路——清空並把游標移回左上角。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { lcdOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:lcd_clear', async (node, ctx) => {
    const s = lcdOf(ctx, String(node.properties.obj ?? 'lcd'))
    s.lines = s.lines.map(() => '')
    s.cursor = [0, 0]
  })
}
