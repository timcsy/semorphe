/** `cpp:lcd_at` 的 **execute** 路——移動游標。⚠️ 行與列都從 0 開始。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { lcdOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:lcd_at', async (node, ctx) => {
    const s = lcdOf(ctx, String(node.properties.obj ?? 'lcd'))
    const col = Math.trunc(ctx.toNumber(await ctx.evaluate((node.children.col ?? [])[0])))
    const row = Math.trunc(ctx.toNumber(await ctx.evaluate((node.children.row ?? [])[0])))
    s.cursor = [Math.max(0, col), Math.max(0, row)]
  })
}
