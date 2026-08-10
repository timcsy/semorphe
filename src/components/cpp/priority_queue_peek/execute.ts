/** `cpp:priority_queue_peek` 的 **execute** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:priority_queue_peek', async (node, ctx) => {
      const name = String(node.properties.obj)
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
        return defaultValue('int')
      }
      // 最大值——**不是** arr.value[0]
      return arr.value.reduce((max, v) =>
        Number(v.value) > Number(max.value) ? v : max,
      )
    })
}
