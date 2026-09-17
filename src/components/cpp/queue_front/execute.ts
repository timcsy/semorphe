/** `cpp:queue_front` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:queue_front', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
      if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
        return defaultValue('int')
      }
      return arr.value[0]
    })
}
