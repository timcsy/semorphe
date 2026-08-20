/**
 * `cpp:cast` 的 **execute** 路
 *
 * ⚠️ `charIsChar: true`——`(char)66` 要印出 `B` 不是 `66`。
 * 四種命名轉型是 `false`（既有差別，見 `core/runtime/cast.ts` 的檔頭）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { numericCast } from '../../../languages/cpp/core/runtime/cast'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:cast', async (node, ctx) => {
    const targetType = String(node.properties.target_type ?? 'int')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    return numericCast(targetType, val, ctx.toNumber(val), { charIsChar: true })
  })
}
