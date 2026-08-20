/**
 * `cpp:digital_read` 的 **execute** 路。
 *
 * ⚠️ **沒接東西的腳位讀回 0**——那與真板子不同（真板子會浮動），
 * 而**可重現比擬真重要**：一個每次讀到不同值的模擬器，測不出任何東西。
 * 🔴 `INPUT_PULLUP` 是例外：它**本來就該讀回 HIGH**（內部提升電阻）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

const INPUT_PULLUP = 2

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:digital_read', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const state = stateOf(ctx, pin)
    if (state.mode === INPUT_PULLUP && state.value === 0) return { type: 'int', value: 1 }
    return { type: 'int', value: state.value === 0 ? 0 : 1 }
  })
}
