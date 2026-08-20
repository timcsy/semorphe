/** `cpp:lcd_open` 的 **execute** 路——記下行列數。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { lcdOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:lcd_open', async (node, ctx) => {
    const s = lcdOf(ctx, String(node.properties.obj ?? 'lcd'))
    s.cols = Math.max(1, ctx.toNumber(await ctx.evaluate((node.children.cols ?? [])[0])))
    s.rows = Math.max(1, ctx.toNumber(await ctx.evaluate((node.children.rows ?? [])[0])))
    s.lines = Array.from({ length: s.rows }, () => '')
    s.cursor = [0, 0]
  })
}
