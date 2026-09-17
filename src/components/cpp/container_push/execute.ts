/** `cpp:container_push` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_push', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const valueNodes = node.slots.value ?? []
      if (valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      arr.value.push(val)
    })
}
