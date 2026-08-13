/**
 * `cpp:cast_static` 的 **execute** 路
 *
 * 轉型的數值語義是**共用的演算法**（`core/runtime/cast.ts`），
 * 不是另一顆元件的實作——四種命名轉型與 C 風格轉型各自宣告自己用它。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { numericCast } from '../../../languages/cpp/core/runtime/cast'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:cast_static', async (node, ctx) => {
    const targetType = String(node.properties.target_type ?? 'int')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    // ⚠️ `charIsChar: true`——命名轉型的 `char` 回整數。這是既有行為，
    // 與 C 風格轉型不同；**搬家不重寫**（要改就另開一個 commit）。
    return numericCast(targetType, val, ctx.toNumber(val), { charIsChar: true })
  })
}
