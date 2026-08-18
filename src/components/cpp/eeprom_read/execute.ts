/**
 * `cpp:eeprom_read` 的 **execute** 路——🟢 **這一顆完全模擬得了**。
 *
 * 內建記憶體就是一塊記憶體：1024 個位元組，初值 0（與出廠的板子一致——
 * ⚠️ 用過的板子裡是上次寫的東西，而**模擬從乾淨的開始**是可重現的那一邊）。
 *
 * > **一個裝置如果它的本質就是資料，那它不需要被模擬——它可以被實作。**
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { eepromOf, requireAddress } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:eeprom_read', async (node, ctx) => {
    const addr = requireAddress(ctx.toNumber(await ctx.evaluate((node.children.address ?? [])[0])))
    return { type: 'int', value: eepromOf(ctx)[addr] }
  })
}
