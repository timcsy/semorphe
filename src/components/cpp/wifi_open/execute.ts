/**
 * `cpp:wifi_open` 的 **execute** 路。
 *
 * ⚠️ **什麼網路都不會連上**——模擬環境沒有網路堆疊。
 * 而引數**要求值過**：SSID 或密碼的變數名打錯時要出聲。
 *
 * 🔴 而「連上了沒」由 `wifi_state` 回答，**而那一顆的答案是一個取捨**——
 * 見它自己的檔頭。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:wifi_open', async (node, ctx) => {
    await ctx.evaluate((node.children.ssid ?? [])[0])
    await ctx.evaluate((node.children.password ?? [])[0])
  })
}
