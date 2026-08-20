/**
 * `cpp:pin_mode` 的 **execute** 路——它**建立**腳位狀態。
 *
 * ⚠️ 狀態機住在語言套件（`core/runtime/arduino-pins.ts`），
 * 而不是 `ExecutionContext`：`src/interpreter` 在中立性護欄的 `NEUTRAL_DIRS` 裡。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:pin_mode', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const mode = ctx.toNumber(await ctx.evaluate((node.children.mode ?? [])[0]))
    stateOf(ctx, pin).mode = mode
  })
}
