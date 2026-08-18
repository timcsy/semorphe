/**
 * `cpp:eeprom_write` 的 **execute** 路。
 *
 * ⚠️ **位址超界要出聲**（見 `arduino-devices.ts` 的 `requireAddress`）——
 * 真板子上寫超界會覆蓋到別的位址，而那是一個學生找不到原因的 bug。
 * 🔴 而**值截成一個位元組**與真板子一致（`EEPROM.write` 只吃 0–255）。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { eepromOf, requireAddress } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:eeprom_write', async (node, ctx) => {
    const addr = requireAddress(ctx.toNumber(await ctx.evaluate((node.children.address ?? [])[0])))
    const value = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))
    eepromOf(ctx)[addr] = Math.trunc(value) & 0xff
  })
}
