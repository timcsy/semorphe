/** `cpp:map_at` 的 **execute** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { defaultValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/std/map/executors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:map_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.children.key ?? []
      if (keyNodes.length === 0) return defaultValue('int')
      const keyVal = await ctx.evaluate(keyNodes[0])
      const map = ctx.scope.get(name)
      if (map.type !== 'array' || !Array.isArray(map.value)) {
        return defaultValue('int')
      }
      const idx = mapFind(map.value, keyVal)
      if (idx === -1) {
        // C++ map auto-inserts default on access
        const newVal = defaultValue('int')
        const pair: RuntimeValue = { type: 'array', value: [keyVal, newVal] }
        map.value.push(pair)
        return newVal
      }
      const pair = map.value[idx]
      if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 2) {
        return pair.value[1]
      }
      return defaultValue('int')
    })
}
