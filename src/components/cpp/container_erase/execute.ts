/** `cpp:container_erase` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/core/executors/containers'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:container_erase', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.children.key ?? []
      if (keyNodes.length === 0) return
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) return
      // Try map-style erase (key-value pairs) first
      const idx = mapFind(arr.value, keyVal)
      if (idx !== -1) {
        arr.value.splice(idx, 1)
        return
      }
      // Set-style erase (direct value match)
      const setIdx = arr.value.findIndex((v: RuntimeValue) => v.value === keyVal.value)
      if (setIdx !== -1) {
        arr.value.splice(setIdx, 1)
      }
    })
}
