/**
 * `cpp:initializer_list` 的 **execute** 路
 *
 * ⚠️ **多數時候它走不到這裡**：消費者（`interpreter/aggregate.ts` 的
 * `evalInitializer`）會先攔截它，因為 `{…}` 要變成什麼**取決於目標型別**
 * ——結構就是聚合初始化，其他就是一串值。
 *
 * 而它仍然需要一個執行器：`{1,2,3}` 出現在**沒有型別脈絡**的位置時
 * （被 `ctx.evaluate` 直接求值），少了這一路會丟 `UNKNOWN_COMPONENT`。
 * 那時它就是一串值——**不猜型別，也不丟錯**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:initializer_list', async (node, ctx) => {
    const values: RuntimeValue[] = []
    for (const v of node.children.values ?? []) values.push(await ctx.evaluate(v))
    return { type: 'array', value: values }
  })
}
