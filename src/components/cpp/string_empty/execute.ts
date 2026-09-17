/** `cpp:string_empty` 的 **execute** 路——從 `std/string/executors.ts` 原封搬過來。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, e: ComponentExecutor) => void): void {
  register('cpp:string_empty', async (node, ctx) => {
    // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
    const val = await ctx.evaluate((node.slots.obj ?? [])[0])
    return { type: 'bool', value: String(val.value).length === 0 }
  })
}
