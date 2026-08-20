/** `cpp:queue_front` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:queue_front', async (node, ctx) => {
      const name = String(node.properties.obj)
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
        return defaultValue('int')
      }
      return arr.value[0]
    })
}
